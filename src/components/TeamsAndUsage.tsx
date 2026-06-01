import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, BarChart3, Plus, FolderSync } from 'lucide-react';

export function TeamsAndUsage() {
  const { user, userTier } = useAuth();
  const [scans, setScans] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  
  const limits: Record<string, number> = { free: 5, pro: 100, enterprise: 1000 };

  useEffect(() => {
    if (!user) return;
    const fetchUsage = async () => {
      const uDoc = await getDoc(doc(db, 'users', user.uid));
      if (uDoc.exists()) {
        setScans(uDoc.data().scansThisMonth || 0);
      }
    };
    const fetchTeams = async () => {
      // Find where user is a team member, but for simplicity we fetch teams they own
      const q = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const tms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(tms);
    };
    fetchUsage();
    fetchTeams();
  }, [user]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTeamName) return;
    try {
      const tRef = await addDoc(collection(db, 'teams'), {
        name: newTeamName,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      // automatically add them as a member
      await addDoc(collection(db, `teams/${tRef.id}/members`), {
        userId: user.uid,
        role: 'owner',
        joinedAt: serverTimestamp()
      });
      setTeams([...teams, { id: tRef.id, name: newTeamName, ownerId: user.uid }]);
      setNewTeamName('');
    } catch(err) {
      console.error(err);
      alert('Error creating team: ' + err);
    }
  }

  const scanLimit = limits[userTier] || 5;
  const percentage = Math.min((scans / scanLimit) * 100, 100);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 flex flex-col items-start gap-12">
      
      {/* Usage Analytics */}
      <div className="w-full">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 mb-6">
          <BarChart3 className="w-6 h-6 text-emerald-500" />
          Usage Analytics
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl w-full">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Current Billing Cycle</p>
              <p className="text-3xl font-bold text-white">{scans} <span className="text-zinc-500 text-lg">/ {scanLimit} scans</span></p>
            </div>
            <div className="uppercase tracking-widest text-xs font-bold px-3 py-1 bg-zinc-800 text-zinc-300 rounded-md">
              {userTier} PLAN
            </div>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 mt-4 overflow-hidden">
            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Teams & Workspaces */}
      <div className="w-full">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-indigo-400" />
          Teams & Workspaces
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Team Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Create New Team</h3>
              <p className="text-sm text-zinc-400 mb-4">Set up a shared workspace for your developers to analyze projects.</p>
            </div>
            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Team Name" 
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
              />
              <button 
                type="submit" 
                className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-600 transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4"/>
                Create
              </button>
            </form>
          </div>

          {/* Teams List */}
          {teams.map(team => (
            <div key={team.id} className="bg-zinc-900/50 border border-zinc-800 border-l-4 border-l-indigo-500 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">{team.name}</h3>
              <p className="text-sm text-zinc-500 mb-4 flex items-center gap-2">
                <FolderSync className="w-4 h-4" /> Shared Projects Workspace
              </p>
              <button className="text-indigo-400 font-medium text-sm hover:text-indigo-300 transition">
                Manage Members →
              </button>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
