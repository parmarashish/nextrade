'use client';

import React from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { apiClient } from '@/lib/api-client';
import { setCredentials } from '@/store/slices/authSlice';

export const ImpersonationBanner: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isImpersonated, user, impersonatedBy } = useAppSelector((state) => state.auth);

  if (!isImpersonated || !user) {
    return null;
  }

  const handleExitImpersonation = async () => {
    try {
      const res = await apiClient.post('/auth/stop-impersonation');
      if (res.data) {
        dispatch(
          setCredentials({
            user: res.data.user,
            token: res.data.accessToken,
            isImpersonated: false,
            impersonatedBy: null,
          })
        );
        window.location.href = '/dealers';
      }
    } catch (err) {
      console.error('Failed to exit impersonation:', err);
    }
  };

  const dealerLabel = user.businessName
    ? `${user.name} (${user.businessName})`
    : user.name;

  const adminName = user.impersonatedByName || impersonatedBy?.name || 'Administrator';

  return (
    <div className="bg-[#FFF4E5] border-b border-[#F5C278] px-6 py-2 flex items-center justify-between text-[#8A5000] text-xs font-medium z-20">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-[#DD7A01] shrink-0" />
        <span>
          <strong>Admin Impersonation Mode:</strong> Currently viewing the portal as{' '}
          <span className="font-bold underline">{dealerLabel}</span>
          <span className="text-[#A2620A] ml-1">
            (Impersonated by: {adminName})
          </span>
        </span>
      </div>

      <button
        onClick={handleExitImpersonation}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#DD7A01] hover:bg-[#B36300] text-white text-xs font-semibold rounded transition-colors shadow-sm"
      >
        <LogOut size={13} />
        Exit Impersonation
      </button>
    </div>
  );
};
