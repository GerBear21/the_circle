import { useState, useEffect } from 'react';
import { Card } from '../../ui';
import { SectionHeading, AccessIcon } from './shared';

export function AccessConfig() {
  const [search, setSearch] = useState('');
  const [accessUsers, setAccessUsers] = useState<any[]>([]);
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          setAccessUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error loading access data:', err);
      } finally {
        setAccessLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredUsers = accessUsers.filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.display_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Access & Rights Assignment" subtitle="View user roles and manage access. For role changes, use the Roles & Access admin page." />

      <Card className="!p-0 overflow-hidden border border-[#E6D3B3]">
        <div className="p-4 bg-[#F3EADC] border-b border-[#E6D3B3] flex items-center gap-4">
          <div className="w-10 h-10 bg-[#F3EADC] rounded-full flex items-center justify-center text-[#9A7545]">
            <AccessIcon />
          </div>
          <div>
            <h3 className="font-semibold text-[#3F2D19]">Restricted Assignment Policy</h3>
            <p className="text-sm text-[#5E4426]">
              For security, roles equal to or higher than <strong>Super Admin</strong> cannot be assigned from this interface.
            </p>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search users..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9A7545] focus:border-[#9A7545]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {accessLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#9A7545] mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">User</th>
                  <th className="px-6 py-3 font-semibold">Assigned Roles</th>
                  <th className="px-6 py-3 font-semibold">Department</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.slice(0, 25).map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F3EADC] text-[#9A7545] flex items-center justify-center font-bold text-xs">
                          {(u.display_name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{u.display_name || 'Unnamed'}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {(u.roles || []).length > 0 ? u.roles.map((r: any) => (
                          <span key={r.id} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border border-gray-200">{r.name}</span>
                        )) : (
                          <span className="text-xs text-gray-400 italic">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.department?.name || '\u2014'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
