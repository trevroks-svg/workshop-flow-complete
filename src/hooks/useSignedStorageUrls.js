import { useQuery } from '@tanstack/react-query';
import { createSignedFileUrls } from '@/api/storage';

export function useSignedStorageUrls(values = []) {
  const stableValues = values.filter(Boolean);
  return useQuery({
    queryKey: ['signed-storage-urls', stableValues],
    queryFn: () => createSignedFileUrls(stableValues),
    enabled: stableValues.length > 0,
    staleTime: 8 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSignedStorageUrl(value) {
  const query = useSignedStorageUrls(value ? [value] : []);
  return {
    ...query,
    data: query.data?.[0] || null,
  };
}
