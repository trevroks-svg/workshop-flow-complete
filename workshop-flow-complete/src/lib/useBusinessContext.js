import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export function useBusinessContext() {
  const { user, isLoadingAuth } = useAuth();

  const staffRole   = user?.staff_role ?? null;
  const businessId  = user?.business_id ?? null;
  const isSuperAdmin     = staffRole === 'super_admin';
  const canManageBusiness = ['admin', 'service_manager', 'super_admin'].includes(staffRole);

  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  /** Stamp business_id onto new records before inserting */
  const stampBusinessId = (data) => {
    if (!businessId) return data;
    return { ...data, business_id: businessId };
  };

  return {
    user,
    userLoading: isLoadingAuth,
    staffRole,
    businessId,
    business,
    businessLoading: businessLoading || isLoadingAuth,
    isSuperAdmin,
    canManageBusiness,
    stampBusinessId,
  };
}
