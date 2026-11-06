"use client";

import Image from "next/image";
import { Loader2, Search } from "lucide-react";
import type { UserDirectoryItem, UserProfile } from "../types";

interface UserManagementTabProps {
  users: UserDirectoryItem[];
  currentUser: UserProfile;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  updatingUserId: string | null;
  onRoleChange: (userId: string, newRole: string) => void;
}

export default function UserManagementTab({
  users,
  currentUser,
  loading,
  searchQuery,
  onSearchChange,
  updatingUserId,
  onRoleChange,
}: UserManagementTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Faculty Role & Privilege Administration
            </h2>
            <p className="text-xs text-slate-500">
              Assign and regulate operational roles across all student accounts, faculty moderators, and system administrators.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, department..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            />
          </div>
        </div>

        {/* Roles explanation card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6 text-xs">
          <div>
            <span className="font-bold text-slate-800">STUDENT:</span>
            <p className="text-slate-500 mt-0.5">
              Can access study vaults, download verified files, and submit materials into review.
            </p>
          </div>
          <div>
            <span className="font-bold text-emerald-800">MODERATOR:</span>
            <p className="text-slate-500 mt-0.5">
              Has review queue access to inspect, approve, and reject academic uploads.
            </p>
          </div>
          <div>
            <span className="font-bold text-purple-800">ADMIN:</span>
            <p className="text-slate-500 mt-0.5">
              Full platform governance, role allocation, and institutional configuration.
            </p>
          </div>
        </div>

        {/* Users Directory Table */}
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading user registry...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No registered users match your search query.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((userItem) => (
              <div
                key={userItem.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                    <Image
                      src={userItem.avatar}
                      alt={userItem.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {userItem.name}
                      </h4>
                      {userItem.id === currentUser.id && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {userItem.email} • {userItem.department} ({userItem.level})
                    </div>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="flex items-center gap-3 shrink-0">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Assigned Role:
                  </label>
                  <select
                    value={userItem.role}
                    disabled={updatingUserId === userItem.id}
                    onChange={(e) => onRoleChange(userItem.id, e.target.value)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${userItem.role === "ADMIN"
                        ? "bg-purple-50 text-purple-900 border-purple-300"
                        : userItem.role === "MODERATOR"
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                          : "bg-slate-50 text-slate-800 border-slate-200"
                      }`}
                  >
                    <option value="STUDENT">STUDENT (General)</option>
                    <option value="MODERATOR">MODERATOR (Faculty Reviewer)</option>
                    <option value="ADMIN">ADMIN (Full Authority)</option>
                  </select>
                  {updatingUserId === userItem.id && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

