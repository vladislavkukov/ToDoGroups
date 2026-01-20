import { useEffect, useState } from 'react'
import './App.css'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { UserCredential, User } from 'firebase/auth';
import {auth} from "./firebase";


type ModalType = "login" | "signup" | null;

type HomeProps = {
    setUser: (user: any) => void;
}

const provider = new GoogleAuthProvider;
provider.addScope('https://www.googleapis.com/auth/contacts.readonly')


function Home({setUser}: HomeProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  return (
    <>
    <h1>Website</h1>
    <h3>Sample Description</h3>
    <button className="front" onClick={() => setModalType("login")}>Log in</button>
    <button className="front" onClick={() => setModalType("signup")}>Sign Up</button>
    {modalType && (<AuthModal type = {modalType} onClose={() => setModalType(null)} setUser = {setUser} />
    )} 
    </>
  )
}

type authModalProps = {
  type: Exclude<ModalType, null>;
  onClose:() => void;
  setUser: (user: any) => void;
}

type AuthFormProps = {
  type: ModalType;
  onSubmit: (data: {
    email: string;
    password: string;
    username?: string;
    passwordc?: string;
  }) => void
  
}

function Form({type, onSubmit}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordc, setPasswordc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {e.preventDefault();
    onSubmit({
      email, password, username, passwordc});
    };

  return (
    <form onSubmit={handleSubmit}>
      {type === "signup" && (
      <label> Username
        <br></br>
        <input className = "inputField" type = "text" value = {username} onChange={(e) => setUsername(e.target.value)} required></input>
        <br></br>
        <br></br>
      </label>
      )}
      <label> Email
        <br></br>
        <input className = "inputField" type = "email" value = {email} onChange={(e) => setEmail(e.target.value)} required></input>
      </label>
      <br></br>
      <br></br>
      <label> Password
        <br></br>
        <input className = "inputField" type = "password" value = {password} onChange={(e) => setPassword(e.target.value)} required></input>
      </label>
      <br></br>
      <br></br>
      {type === "signup" && (
       <label> Confirm Password
        <br></br>
        <input className = "inputField" type = "password" value = {passwordc} onChange={(e) => setPasswordc(e.target.value)} required></input>
      </label>
      )}
      <br></br>
      <br></br>
      <div className="submitButton">
        <button className = "submitB" >{type === "login" ? "Log In" : "Sign Up"}</button>
      </div>

    </form>

  )
}


function AuthModal({type, onClose, setUser}: authModalProps) {
  const [errormessage, setErrorMessage] = useState<string | null>(null);
  return (
    <div className = "overlay" onClick={onClose}>
      <div className= "modal" onClick = {(e) => e.stopPropagation()}>
        <button className='close' onClick = {onClose}>X</button>
        <div className='submitButton'>
          <h2> {type === "login" ? "Log In" : "Sign Up"} </h2>
        </div>
        <div className ='login'>
        {type === "signup" ? (
          <Form type={"signup"} onSubmit={(data) => 
          {setErrorMessage(null);
          createUserWithEmailAndPassword(auth, data.email, data.password).then((userCredential: UserCredential) => 
          {
          const user = userCredential.user;
          updateProfile(user, {displayName: data.username});
          }).catch((error) => {
          const errorMessage = error.message;
          setErrorMessage(errorMessage);                               
          })
          }}/>) 
          :
          (<Form type="login" onSubmit={(data) =>
          {setErrorMessage(null);          
          signInWithEmailAndPassword(auth, data.email, data.password).then((userCredential: UserCredential) =>
          {
              const user = userCredential.user;
              setUser(user);

          }).catch ((error) => {
              const errorMessage = error.message;
            setErrorMessage(errorMessage);
          })
          }}
          />)}

          </div>
          <div className='third'>
            <h3> Sign in with Google: </h3>
            <button className='google' onClick= { () =>
            signInWithPopup(auth, provider).then((result) => {
                const cred = GoogleAuthProvider.credentialFromResult(result);
                const token = cred?.accessToken;
                const user = result.user;
            }).catch((error) => {
                const errormessage = error.message;
            })} >   <img className='google' src = "google.png"></img>  </button>

          </div>
      {errormessage && (<p style={{ color: "red", marginBottom: "3px" }}> {errormessage} </p>)}

      </div>
    </div>
  );
}



export default Home
