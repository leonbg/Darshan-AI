import { useState, useEffect, useCallback } from 'react';
import { TorahCalendarData } from '../types';
import { fetchTorahCalendar } from '../services/api';

export function useTorahCalendar() {
  const [calendarData, setCalendarData] = useState<TorahCalendarData | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(true);

  const loadCalendar = useCallback(async (params?: { diaspora?: boolean; date?: string }) => {
    setIsLoadingCalendar(true);
    try {
      const cal = await fetchTorahCalendar(params);
      setCalendarData(cal);
    } catch (err) {
      console.warn('Warning loading Torah calendar:', err);
    } finally {
      setIsLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar({ diaspora: true });
  }, [loadCalendar]);

  return {
    calendarData,
    isLoadingCalendar,
    loadCalendar,
  };
}
