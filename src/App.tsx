import { useEffect, useState } from 'react'
import './App.css'
import Dash from './dash.tsx'
import Home from './home.tsx'
import {auth} from "./firebase";


function App() {
  // Stores current user, none if logged out
  const [user, setUser] = useState<any>(null);
  // No home page before loading
  const [loading, setLoading] = useState(true);

  // Get firebase authentication changes, check immediately with current user
  useEffect(() => {
  const out = auth.onAuthStateChanged((user) => {
    setUser(user);
    setLoading(false)
  });
  return () => out();
}, []);

// Begin loading when firebase gets the session
if (loading) return <p>loading</p>

return user ? <Dash user={user} setUser = {setUser}/> : <Home setUser={setUser}/>  
}

export default App