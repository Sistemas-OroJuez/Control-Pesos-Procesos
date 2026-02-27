'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('empleados')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (err || !data) {
      setError('Credenciales incorrectas.');
      setLoading(false);
    } else {
      // AQUÍ ES DONDE OCURRE LA MAGIA:
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-700">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">OROJUEZ <span className="text-red-700">SA</span></h1>
            <div className="h-1 w-20 bg-red-700 mx-auto mt-2"></div>
            <p className="text-gray-500 mt-4 text-sm font-semibold uppercase tracking-widest">Control de Pesos</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</p>}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Correo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-red-200" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Contraseña</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-red-200" />
            </div>
            <button disabled={loading} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-lg shadow-lg transition-all uppercase tracking-wider text-sm">
              {loading ? 'Entrando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
