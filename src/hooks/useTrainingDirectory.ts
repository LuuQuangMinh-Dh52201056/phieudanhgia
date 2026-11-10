import { useCallback, useEffect, useState } from 'react'
import { subscribeTrainingDirectory } from '../services/trainingDirectoryStore'
import type { TrainingDirectoryState } from '../types/trainingDirectory'

const initialState: TrainingDirectoryState = {
  teachers: [],
  vehicles: [],
  loading: true,
  error: '',
  teachersLoading: true,
  vehiclesLoading: true,
  teacherError: '',
  vehicleError: '',
}

export function useTrainingDirectory() {
  const [state, setState] = useState(initialState)
  const [subscriptionVersion, setSubscriptionVersion] = useState(0)

  useEffect(() => subscribeTrainingDirectory(setState), [subscriptionVersion])

  const refresh = useCallback(() => {
    setSubscriptionVersion((current) => current + 1)
  }, [])

  return { ...state, refresh }
}
