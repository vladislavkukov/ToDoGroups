import { useEffect, useState } from 'react'
import './App.css'
import Dash from './dash.tsx'
import Home from './home.tsx'
import {auth} from "./firebase";




function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const out = auth.onAuthStateChanged((user) => {
    setUser(user);
    setLoading(false)
  });
  return () => out();
}, []);

if (loading) return <p>loading</p>

return user ? <Dash/> : <Home setUser={setUser}/>  
}

export default App