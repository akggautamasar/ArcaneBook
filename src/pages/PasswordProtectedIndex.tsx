import {useState,type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';
export default function PasswordProtectedIndex(){const {signIn}=useAuth();const navigate=useNavigate();const {toast}=useToast();const [password,setPassword]=useState('');const [loading,setLoading]=useState(false);const submit=async(e:FormEvent)=>{e.preventDefault();setLoading(true);const result=await signIn(password);setLoading(false);setPassword('');if(result.error){toast({title:'Access denied',description:result.error,variant:'destructive'});}else{navigate('/admin');}};return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Admin Access</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Label htmlFor="password">Admin password</Label><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus required/><Button className="w-full" type="submit" disabled={loading}>{loading?'Checking…':'Access Quiz Builder'}</Button></form></CardContent></Card></div>;}
