import { Navigate } from 'react-router-dom'
import { useApi } from '../api/client'
import type { District } from '../api/types'
import { Empty, ErrorBox, Loading } from '../components/ui'

/** /district -> /district/<default>. Jalgaon was the original landing district. */
export default function DistrictIndex() {
  const { data, error } = useApi<District[]>('/districts')
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const d = data.find((x) => x.name === 'Jalgaon') ?? data[0]
  return d ? <Navigate to={`/district/${d.id}`} replace /> : <Empty>No districts loaded.</Empty>
}

