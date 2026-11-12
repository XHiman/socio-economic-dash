#!/usr/bin/env python3
"""
Load another DSA edition (a "database-ready" workbook, one sheet per table) into the dev Docker MariaDB.

    python db/dev/load_dsa_edition.py path/to/DSA_2023-24_mariadb_ready_EN.xlsx            # dry run, prints the plan
    python db/dev/load_dsa_edition.py path/to/DSA_2023-24_mariadb_ready_EN.xlsx --apply    # writes

Safe to re-run: each table's rows for the workbook's reference_year are deleted and re-inserted.
Other editions already in the database are never modified.

  * sheet -> table of the same name; workbook columns missing in the table are added (type from meta_column)
  * taluka_name -> taluka_id via dim_taluka (punctuation/case-insensitive); unseen names are added to dim_taluka;
    total rows (is_total_row = 1) get taluka_id NULL, like the existing data; footnote "names" such as "(2)" are skipped
  * dsa_21..dsa_24 feed dsa_gddp (src_table = sheet name). Years that an existing edition already has are NOT
    loaded again, otherwise every district would appear twice in the GDDP queries.
Requires: pip install openpyxl; the socioecon-mariadb container from docker-compose.yml running.
"""
import re
import subprocess
import sys
from collections import defaultdict

import openpyxl

CONTAINER, DB, PW = 'socioecon-mariadb', 'socioecon', 'dev_root_password'
GDDP_SHEETS = ['dsa_21', 'dsa_22', 'dsa_23', 'dsa_24']
SUPPORT = {'README', 'dim_district', 'meta_table', 'meta_column', 'data_cell_note'}
BATCH = 400


def sql(statement: str, stdin: str | None = None) -> list[list[str]]:
    cmd = ['docker', 'exec', '-i', CONTAINER, 'mariadb', '-uroot', f'-p{PW}', '--default-character-set=utf8mb4', '-N', '-B', DB]
    if stdin is None:
        cmd += ['-e', statement]
    r = subprocess.run(cmd, input=stdin, capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise SystemExit(f'SQL failed: {r.stderr.strip()[:300]} ... {r.stderr.strip()[-400:]}')
    return [line.split('\t') for line in r.stdout.splitlines()]


def lit(v) -> str:
    if v is None or v == '':
        return 'NULL'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace('\\', '\\\\').replace("'", "''") + "'"


def norm(name: str) -> str:
    return re.sub(r'[^a-z0-9]', '', name.lower())


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    path, apply = sys.argv[1], '--apply' in sys.argv
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    db_cols: dict[str, list[str]] = defaultdict(list)
    for t, c in sql(f"SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='{DB}' ORDER BY table_name, ordinal_position"):
        db_cols[t].append(c)

    numeric: set[tuple[str, str]] = set()
    for t, c in sql(f"SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='{DB}' AND data_type IN ('tinyint','smallint','mediumint','int','bigint','decimal','float','double')"):
        numeric.add((t, c))
    text_in_numeric: dict[str, int] = defaultdict(int)
    varchars: dict[tuple[str, str], tuple[int, str, str]] = {}
    for t, c, n, nullable, comment in sql(f"SELECT table_name, column_name, character_maximum_length, is_nullable, column_comment FROM information_schema.columns WHERE table_schema='{DB}' AND data_type='varchar'"):
        varchars[(t, c)] = (int(n), nullable, comment)

    types = {(r[0], r[1]): r[4] for r in wb['meta_column'].iter_rows(min_row=2, values_only=True) if r[0]}

    # dim_district must agree, or district_id in the workbook means something else.
    have = {int(a): (b, c) for a, b, c in sql('SELECT district_id, name_en, division_en FROM dim_district')}
    for r in wb['dim_district'].iter_rows(min_row=2, values_only=True):
        if r[0] and have.get(int(r[0])) != (r[1], r[2]):
            raise SystemExit(f'dim_district mismatch for id {r[0]}: workbook {r[1:]} vs database {have.get(int(r[0]))}')

    talukas: dict[int, dict[str, int]] = defaultdict(dict)
    for tid, did, nm in sql('SELECT taluka_id, district_id, name_en FROM dim_taluka'):
        talukas[int(did)][norm(nm)] = int(tid)
    next_tid = max((t for d in talukas.values() for t in d.values()), default=0) + 1
    new_talukas: list[tuple[int, int, str]] = []

    def taluka_id(did: int, name: str) -> int:
        nonlocal next_tid
        key = norm(name)
        if key not in talukas[did]:
            talukas[did][key] = next_tid
            new_talukas.append((next_tid, did, name))
            next_tid += 1
        return talukas[did][key]

    alters: list[str] = []
    inserts: list[tuple[str, str, str]] = []  # (label, delete sql, insert sql)
    plan: list[str] = []
    edition = None

    for sheet in wb.sheetnames:
        if sheet in SUPPORT:
            continue
        rows = wb[sheet].iter_rows(values_only=True)
        header = [h for h in next(rows) if h]
        target = 'dsa_gddp' if sheet in GDDP_SHEETS else sheet
        if target not in db_cols:
            plan.append(f'SKIP {sheet}: no such table in the database')
            continue
        cols = db_cols[target]
        if 'reference_year' not in cols or 'reference_year' not in header:
            plan.append(f'SKIP {sheet}: no reference_year, cannot load idempotently')
            continue

        data = [dict(zip(header, r)) for r in rows if any(c is not None for c in r)]
        years = {d['reference_year'] for d in data}
        if len(years) != 1:
            raise SystemExit(f'{sheet}: expected one reference_year, found {years}')
        ref = years.pop()
        edition = edition or ref
        if ref != edition:
            raise SystemExit(f'{sheet}: reference_year {ref} differs from {edition}')

        def num_or_null(h: str, v):
            # Text such as 'Not available' in a numeric column (data_cell_note: TEXT_IN_NUMERIC) is stored as NULL.
            if isinstance(v, str) and ((target, h) in numeric or h in new_numeric):
                try:
                    return float(v.replace(',', ''))
                except ValueError:
                    text_in_numeric[sheet] += 1
                    return None
            return v

        new_numeric: set[str] = set()
        # Text longer than the column allows (the schema was sized from another edition): widen the column.
        for h in header:
            if (target, h) in varchars:
                width, nullable, comment = varchars[(target, h)]
                need = max((len(str(d[h])) for d in data if isinstance(d.get(h), str)), default=0)
                if need > width:
                    new_width = -(-need // 16) * 16
                    alters.append(f"ALTER TABLE `{target}` MODIFY COLUMN `{h}` VARCHAR({new_width}) {'NULL' if nullable == 'YES' else 'NOT NULL'} COMMENT {lit(comment)};")
                    plan.append(f'ALTER {target}: widen {h} VARCHAR({width}) -> VARCHAR({new_width})')
        # Columns the workbook has but the table doesn't: add them (never drop or alter existing ones).
        for h in header:
            if h in ('district_name', 'taluka_name') or h in cols:
                continue
            ctype = 'TINYINT(1) NOT NULL DEFAULT 0' if h == 'is_dup_row' else f'{types.get((sheet, h), "DECIMAL(20,5)")} NULL'
            alters.append(f'ALTER TABLE `{target}` ADD COLUMN `{h}` {ctype};')
            cols = cols + [h]
            if re.match(r'(TINYINT|SMALLINT|INT|BIGINT|DECIMAL|FLOAT|DOUBLE)', ctype):
                new_numeric.add(h)
            plan.append(f'ALTER {target}: add {h} {ctype}')
        # dsa_gddp stays one row per district/year: skip years an existing edition already supplies.
        if target == 'dsa_gddp':
            have_rows = {(a, int(b), c) for a, b, c in sql(f"SELECT src_table, district_id, data_year FROM dsa_gddp WHERE reference_year <> '{ref}'")}
            before = len(data)
            data = [d for d in data if (sheet, int(d['district_id']), d['data_year']) not in have_rows]
            plan.append(f'{sheet} -> dsa_gddp: {len(data)} of {before} rows (rest already in another edition)')
            for d in data:
                d['src_table'] = sheet

        has_taluka = 'taluka_id' in cols and 'taluka_name' in header
        out_cols = [c for c in cols if c not in ('id', 'taluka_id') and (c in header or c == 'src_table')]
        if has_taluka:
            out_cols.append('taluka_id')
        values, skipped = [], 0
        for d in data:
            tid = None
            if has_taluka:
                name = d.get('taluka_name')
                if name is not None and not d.get('is_total_row'):
                    if re.fullmatch(r'\(\d+\)', str(name).strip()):
                        skipped += 1
                        continue
                    tid = taluka_id(int(d['district_id']), str(name).strip())
            d['taluka_id'] = tid
            values.append('(' + ','.join(lit(num_or_null(c, d.get(c))) for c in out_cols) + ')')
        if target != 'dsa_gddp':
            plan.append(f'{sheet}: {len(values)} rows' + (f' ({skipped} footnote rows skipped)' if skipped else ''))
        col_sql = ','.join(f'`{c}`' for c in out_cols)
        stmts = [f'INSERT INTO `{target}` ({col_sql}) VALUES ' + ','.join(values[i:i + BATCH]) + ';' for i in range(0, len(values), BATCH)]
        if target == 'dsa_gddp':
            delete = f"DELETE FROM dsa_gddp WHERE reference_year = '{ref}' AND src_table = '{sheet}';"
        else:
            delete = f"DELETE FROM `{target}` WHERE reference_year = '{ref}';"
        inserts.append((sheet, delete, '\n'.join(stmts)))

    print(f'Edition {edition}: {len(inserts)} tables, {len(new_talukas)} new talukas, {len(alters)} new columns')
    for line in plan:
        print('  ', line)
    for t, n in sorted(text_in_numeric.items()):
        print(f'   {t}: {n} text cells in numeric columns stored as NULL')
    for tid, did, nm in new_talukas:
        print(f'   new taluka {tid}: district {did} {nm}')
    if not apply:
        print('\nDry run only. Re-run with --apply to write.')
        return

    for a in alters:
        sql(a)
    script = ['SET FOREIGN_KEY_CHECKS=1;', 'START TRANSACTION;']
    for tid, did, nm in new_talukas:
        script.append(f'INSERT INTO dim_taluka (taluka_id, district_id, name_en) VALUES ({tid},{did},{lit(nm)});')
    for _, delete, insert in inserts:
        script += [delete, insert]
    script.append('COMMIT;')
    sql('', stdin='\n'.join(script))
    print('Applied. Rows now per edition:')
    for r in sql("SELECT reference_year, COUNT(*) FROM dsa_gddp WHERE src_table='dsa_21' GROUP BY 1"):
        print('   dsa_gddp/dsa_21', r)
    for t in ('dsa_11a', 'dsa_71', 'dsa_87'):
        for r in sql(f'SELECT reference_year, COUNT(*) FROM {t} GROUP BY 1'):
            print('  ', t, r)


if __name__ == '__main__':
    main()
