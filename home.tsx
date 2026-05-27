import { useEffect, useState } from 'react'
import './App.css'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { UserCredential, User } from 'firebase/auth';
import {setDoc, doc, collection, query, where, getDocs} from 'firebase/firestore'
import {auth, db} from "./firebase";
import googleLogo from "./google.webp"


type ModalType = "login" | "signup" | null;

type HomeProps = {
    setUser: (user: any) => void;
}
// Gets google authentication for login
const provider = new GoogleAuthProvider;
provider.addScope('https://www.googleapis.com/auth/contacts.readonly')


// Shows opening text and buttons to login and sign up
function Home({setUser}: HomeProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  return (
    <div className='homepage'>
    <div className='mainrows'>
    <h1>A place to make and achieve goals.<br/> By yourself or with the support of others.</h1>
    <div className='buttons'>
    {/* Buttons which create relevant modals when butons are clicked */}
    <button className="front" onClick={() => setModalType("login")}>Log in</button>
    <button className="frontup" onClick={() => setModalType("signup")}>Sign Up</button>
    </div>
    </div>
    {modalType && (<AuthModal type = {modalType} onClose={() => setModalType(null)} setUser = {setUser} />
    )} 
    </div>
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
// Sign up and login form which has different content depending on which type it is 
function Form({type, onSubmit}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordc, setPasswordc] = useState("");
  const [formError, setFormError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure password is confirmed
    if (type === "signup" && password != passwordc) {
      setFormError("Passwords don't match")
      return;
    }
    onSubmit({
      email, password, username, passwordc});
    };

  return (
    // Only relevant fields shown and all are required depending on if it is a new sign up or a log in 
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
      <p>{formError}</p>
    </form>

  )
}

// Modal for the log in logic which closes either with the X button or a click on the overlay outside of the modal itself
function AuthModal({type, onClose, setUser}: authModalProps) {
  const [errormessage, setErrorMessage] = useState<string | null>(null);
  return (
    // Closes when clicked on overlay
    <div className = "overlay" onClick={onClose}>
      {/* Doesn't close when clicking on modal */}
      <div className= "modal" onClick = {(e) => e.stopPropagation()}>
        {/* X button closes it*/}
        <button className='close' onClick = {onClose}>X</button>
        <div className='submitButton'>
          <h2> {type === "login" ? "Log In" : "Sign Up"} </h2>
        </div>
        <div className ='login'>
        {type === "signup" ? (
          <Form type={"signup"} onSubmit={async (data) => 
          {setErrorMessage(null);
          // Ensures usernames doesn't already exist when creating an account
          const nameCheck = query(collection(db, "userInfo"), where("username", "==", data.username));
          const duplicate = await getDocs(nameCheck);
          if (!duplicate.empty) {
            setErrorMessage("Username Taken")
            return;
          }
          // Creates firestore user 
          createUserWithEmailAndPassword(auth, data.email, data.password).then((userCredential: UserCredential) => 
          {
          const user = userCredential.user;
          updateProfile(user, {displayName: data.username});
          // Initializes relevant attributes to the user
          setDoc(doc(db, "userInfo", user.uid), {
            points: 0,
            userId: user.uid,
            joinedGroups: [],
            username: data.username
          })
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
              // Once a user is set the home page is automatically opened 
              setUser(user);

          }).catch ((error) => {
              const errorMessage = error.message;
            setErrorMessage(errorMessage);
          })
          }}
          />)}

          </div>
          {/* Google login */}
          <div className='third'>
            <h3> Sign in with Google: </h3>
            <button className='google' onClick= {() =>
            signInWithPopup(auth, provider).then((result) => {
                const cred = GoogleAuthProvider.credentialFromResult(result);
                const token = cred?.accessToken;
                const user = result.user;
                // Creates a firestore user doc on sign up oly
                if (type !== "login") {
                  setDoc(doc(db, "userInfo", user.uid), {
                    points: 0,
                    userId: user.uid,
                    joinedGroups: [],
                    // No username initially but can be changed later on 
                    username: user.uid
                })
                updateProfile(user, {displayName: user.uid});
                }
            }).catch((error) => {
                const errormessage = error.message;
            })} >   <img className='google' src = {googleLogo}></img>  </button>

          </div>
      {errormessage && (<p style={{ color: "red", marginBottom: "3px" }}> {errormessage} </p>)}

      </div>
    </div>
  );
}



export default Home
