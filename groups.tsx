import { useEffect, useState, type FormEvent, type ChangeEvent, useMemo } from 'react';
import { addDoc, collection, onSnapshot, query, where, orderBy, doc, deleteDoc, getDocs, getDoc, setDoc, updateDoc, increment, arrayRemove, arrayUnion, Timestamp, limit} from "firebase/firestore";
import {auth, db} from "./firebase";
import './dash.css';


function Groups({changePage, user}: {changePage: (page: "dash" |"groups")=>void; user: any}) {
    const [curUser, setCurUser] = useState(user);
    const [curGroup, setCurGroup] = useState<Groups | null>(null);
    return(<div><button onClick={() => changePage("dash")}>Dash</button>
    <ShowGroups setCurGroup={setCurGroup} curUser={curUser}/>
    <CurrentGroup curGroup = {curGroup} curUser={curUser}/> </div>)
}

function ShowGroups({setCurGroup, curUser} : {setCurGroup: (curGroup: Groups|null) => void, curUser:any}) {
    const [groupL, setGroupL] = useState<Groups[]>([]);
    const [search, setSearch] = useState("");
    const [joinedGroupss, setJoinedGroups] = useState<string[]>([]);
    const [createName, setCreateName] = useState("");
    const [toJoin, setToJoin] = useState("");
    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    }

    const handleJoin = async (groupId: string, membership: boolean) => {
        if (!membership){
            setJoinedGroups(prev => [...prev, groupId])
            await updateDoc(doc(db, "userInfo", curUser.uid),
            {joinedGroups: arrayUnion(groupId)})
            }
        else {
            setJoinedGroups(prev => prev.filter(id=> id !== groupId))
            await updateDoc(doc(db, "userInfo", curUser.uid),
            {joinedGroups: arrayRemove(groupId)})
            } 
        }

    const createGroup = async(groupName: string) => {
        const groupId = await addDoc(collection(db, "group"), {
                name: groupName,
                popCount: 0
             })   
        await updateDoc(doc(db, "userInfo", curUser.uid),
            {joinedGroups: arrayUnion(groupId.id)})
            }
    
    useEffect(() => {
        const load = async () => {
        const groups = await getDocs(collection(db, "group"));
        const groupList: Groups[] = groups.docs.map(docu =>
        ({id: docu.id, ... (docu.data() as Omit<Groups, "id">)}));
        setGroupL(groupList)
        const infoDoc = doc(db, "userInfo", curUser.uid);
        const getDocc = await getDoc(infoDoc);
        const gList = getDocc.get("joinedGroups") ?? [];
        setJoinedGroups(gList);
    
    };
        load();
    }, [])

    const filtered = useMemo(() =>
    {
        const term = search.trim().toLowerCase();
        const list = !term ? groupL : groupL.filter(g => g.name.toLowerCase().includes(term));
        return [...list].sort((a,b)=> (b.popCount ?? 0) - (a.popCount ??0)).slice(0,10)
    }, [groupL, search])

    return(
        <div>
            <h4>Create a group: </h4>
            <p>Name:</p>
            <input value = {createName} onChange={e => setCreateName(e.target.value)}/>
            <button onClick={()=> createGroup(createName)}>Create</button>
            <h4>Join group with JoinID: </h4>
            <input value = {toJoin} onChange={e => setToJoin(e.target.value)}/>
            <button onClick={()=> handleJoin(toJoin, false)}>Join</button>
            <h2>Popular Groups</h2>
            <h4>Search for a group:</h4>
            <input value={search} onChange={handleSearch}/>
            <ul>
                {filtered.map(groupN => {
                    const membership = joinedGroupss.includes(groupN.id);
                return(
                    <div key = {groupN.id}>
                    <li> {groupN.name}</li>
                    {membership &&<button onClick={() => setCurGroup(groupN)}>View</button>}
                    <button onClick={() => handleJoin(groupN.id, membership)}>{membership ? "Leave" : "Join"}</button>
                    </div>)
})}
            </ul>
            <h2>My Groups</h2>
            <ul>
                {filtered.map(groupN => {
                    const membership = joinedGroupss.includes(groupN.id);
                return(
                    <div key = {groupN.id}>
                    {membership && ( <><li> {groupN.name}</li> 
                    <button onClick={() => setCurGroup(groupN)}>View</button>
                    <button onClick={() => handleJoin(groupN.id, membership)}>{membership ? "Leave" : "Join"}</button>
                    </> )} </div>) 
})}
            </ul>
        </div>
    )
    
}

function CurrentGroup({curGroup, curUser}:{curGroup:Groups|null, curUser:any}) {
    const [postss, setPostss] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [toSend, setToSend] = useState("");
    const handleLike = async (post: Post) => {
        if (!curGroup) return;
        if (!(post.likeIds.includes(curUser.uid))) {
        setPostss(prev => 
            prev.map(p =>
                p.id == post.id ? {...p, likeIds: [...p.likeIds, curUser.uid]}:p
            )
        );}
        await updateDoc(doc(db, "group", curGroup.id, "posts", post.id),
        {likeIds: arrayUnion(curUser.uid)})
    }

    const sendMessage = async (message: string) => {
      await addDoc(collection(db, "group", curGroup!.id, "messages"), {
                content: message,
                timestamp: Timestamp.now(),
                username: curUser.displayName
             })
        await updateDoc(doc(db, "group", curGroup!.id), {
            popCount: increment(1)
        })
    }

    useEffect(() => {
        if (!curGroup) return;
        const msgLoc = collection(db, "group", curGroup.id, "messages")
        const q = query(msgLoc, orderBy("timestamp", "asc"), limit(20))
        const unsub = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data() as any})))
        });
        return () => unsub();
    }, [curGroup?.id])

    useEffect(() => {
        if (!curGroup) return;
        const load = async () => {
        const postsLoc = collection(db, "group", curGroup.id, "posts")
        const q = query(postsLoc);
        const posts = await getDocs(q);
        setPostss(posts.docs.map(p => ({id: p.id, ...p.data() as any})))
}; load()}, [curGroup?.id])

    const [pointMap, setPointMap] = useState<Record<string, number>>({})
    const results: Record<string, number> = {}
    useEffect(() => {
        const getUsers = async () => {
        const userIds = [...new Set(postss.map(p=> p.userId))];
        await Promise.all(userIds.map(async(uid) => {
            const snap = await getDoc(doc(db, "userInfo", uid));
            if (snap.exists()) {
                results[uid] = snap.data().points;
            }
        }))
        setPointMap(results)
    }; getUsers();}, [postss] )

    if (!curGroup) return null;
    return(<div>
        <p>{curGroup?.name}</p>
        <p>Join ID: {curGroup?.id}</p>
        <ul>
            {postss.map((p) => 
            <li key = {p.id}>{p.username} Points: {pointMap[p.userId]}: <br/> {p.content} <br/> posted on: {p.date.toDate().toDateString()} <br/> Congratulations: {p.likeIds.length}  <br/> <button onClick={()=>handleLike(p)}>Congratulate</button></li>)}
        </ul>
        <ul>
            {messages.map((m) =>
            <li key = {m.id}>{m.username}: {m.content}</li>)}
        </ul>
        <p>Send a message: </p>
        <input value={toSend} onChange={e => setToSend(e.target.value)}/>
        <button onClick={()=> sendMessage(toSend)}>Send</button>
        </div>)
}


interface Groups {
    id: string;
    name: string;
    popCount: number;
}

interface Message {
    id: string;
    username: string;
    content: string;
    timestamp: Timestamp;
}

interface Post {
    id: string;
    userId: string;
    content: string;
    likeIds: string[];
    date: Timestamp;
    username:string;
}

export default Groups