import { useEffect, useState, type ChangeEvent, useMemo} from 'react';
import { addDoc, collection, onSnapshot, query, orderBy, doc, getDocs, getDoc, updateDoc, increment, arrayRemove, arrayUnion, Timestamp, limit} from "firebase/firestore";
import {db} from "./firebase";
import './dash.css';
import './groups.css'


// Function for which group is currently being displayed and return button
function Groups({changePage, user}: {changePage: (page: "dash" |"groups")=>void; user: any}) {
    const [curUser] = useState(user);
    // No group displayed when null
    const [curGroup, setCurGroup] = useState<Groups | null>(null);
    return(<div><button className='returndash' onClick={() => changePage("dash")}>Dash</button>
    {/* Passes on the current user and group to the next functions as well as the setter for the group */}
    <ShowGroups setCurGroup={setCurGroup} curUser={curUser}/>
    <CurrentGroup curGroup = {curGroup} curUser={curUser}/> </div>)
}

// Section for exploring, creating and joining groups
function ShowGroups({setCurGroup, curUser} : {setCurGroup: (curGroup: Groups|null) => void, curUser:any}) {
    const [groupL, setGroupL] = useState<Groups[]>([]);
    const [search, setSearch] = useState("");
    const [joinedGroupss, setJoinedGroups] = useState<string[]>([]);
    const [createName, setCreateName] = useState("");
    const [toJoin, setToJoin] = useState("");

    // Dynamically changes the searched value when looking for groups
    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    }

    const [createMessage, setCreateMessage] = useState("");

    // Updates group membership both locally and in firestore separately to ensure consistensy 
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

    // User can make a new group by using the name and will auto-join when created
    const createGroup = async(groupName: string) => {
        const groupId = await addDoc(collection(db, "group"), {
                name: groupName,
                popCount: 0
             })   
        await updateDoc(doc(db, "userInfo", curUser.uid),
            {joinedGroups: arrayUnion(groupId.id)})
            setCreateMessage("Group Created! Refresh to update");
            }
            
    
    // Loads all of a user's joined groups, membership is an attribute of a user rather than a group having members as attributes, doesn't update until refresh
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

    // Groups are filtered by the search term and sorted by popularity score, as of now one search bar is applied for explore and joined groups
    const filtered = useMemo(() =>
    {
        const term = search.trim().toLowerCase();
        const list = !term ? groupL : groupL.filter(g => g.name.toLowerCase().includes(term));
        return [...list].sort((a,b)=> (b.popCount ?? 0) - (a.popCount ??0)).slice(0,10)
    }, [groupL, search])

    return(
        <div>
            <h1 className='begtitle'>Create or find a new group!</h1>
            <div className='newgroups'>
            <div className='exploregroups'>
            {/* Explore section allows users to search for a a group, provides list of top groups limited to 10 */}
            <h2>Explore Groups</h2>
            <h4>Search for a group:</h4>
            <input className='textzone' value={search} onChange={handleSearch}/>
            <ul>
                {filtered.slice(0,10).map(groupN => {
                    const membership = joinedGroupss.includes(groupN.id);
                return(
                    <div key = {groupN.id}>
                    <li> <h2> {groupN.name} </h2> <br/> Popularity score: {groupN.popCount}</li>
                    {/* Leave/Join and view buttons are displayed depending on membership */}
                    {membership &&<button className='viewbut' onClick={() => setCurGroup(groupN)}>View</button>}
                    <button className='leavejoin' onClick={() => handleJoin(groupN.id, membership)}>{membership ? "Leave" : "Join"}</button>
                    </div>)
})}
            </ul>
            </div>
            {/* Section where users can join a new group when they know what they are looking for. Can either create a new one or join based on a joinID shared elsewhere */}
            <div className='makejoin'>
            <div className='creategroup'>
            <h4>Create a group </h4>
            <p>Name:</p>
            <input className='textzone' value = {createName} onChange={e => setCreateName(e.target.value)}/>
            <button className='createjoin' onClick={()=> createGroup(createName)}>Create</button>
            <p>{createMessage}</p>
            </div>
            <div className='joingroup'>
            <h4>Join group with JoinID: </h4>
            <input className='textzone' value = {toJoin} onChange={e => setToJoin(e.target.value)}/>
            <button className='createjoin' onClick={()=> handleJoin(toJoin, false)}>Join</button>
            </div>
            </div>
            
            </div>
            {/* Scrollable list of joined groups  */}
            <h1 className='begtitle'>My Groups</h1>
            <ul className='grouplist'>
                {filtered.map(groupN => {
                    const membership = joinedGroupss.includes(groupN.id);
                    {/* Ensures that groups which aren't joined don't create a blank element */}
                    if (!membership) return null;
                return(
                    <div className='groupind' key = {groupN.id}>
                    {membership && ( <><li> {groupN.name}</li> 
                    <button className='viewbut' onClick={() => setCurGroup(groupN)}>View</button>
                    <button className='leavejoin' onClick={() => handleJoin(groupN.id, membership)}>{membership ? "Leave" : "Join"}</button>
                    </> )} </div>) 
})}
            </ul>
        </div>
    )
    
}

// Function to display the contents of a selected group including posts and messages created by users as well as a header with the name and ID of the group
function CurrentGroup({curGroup, curUser}:{curGroup:Groups|null, curUser:any}) {
    const [postss, setPostss] = useState<Post[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [toSend, setToSend] = useState("");
    // Updates like count when a post is congratulated both locally and in the database for an up to date view
    const handleLike = async (post: Post) => {
        if (!curGroup) return;
        // Update like count locally
        if (!(post.likeIds.includes(curUser.uid))) {
        setPostss(prev => 
            prev.map(p =>
                p.id == post.id ? {...p, likeIds: [...p.likeIds, curUser.uid]}:p
            )
        );}
        // Update the like count in firestore
        await updateDoc(doc(db, "group", curGroup.id, "posts", post.id),
        {likeIds: arrayUnion(curUser.uid)})
    }

    // Sends a chat message to the group by updating the messages folder of the group in firestore 
    const sendMessage = async (message: string) => {
        if (!message.trim()) return;
        // Clears box after sending
        setToSend("");
      await addDoc(collection(db, "group", curGroup!.id, "messages"), {
                content: message,
                timestamp: Timestamp.now(),
                username: curUser.displayName
             })
        // Messages increase the popularity score by 1
        await updateDoc(doc(db, "group", curGroup!.id), {
            popCount: increment(1)
        })
    }

    // Gets real-time messages from firestore up to the last 20 
    useEffect(() => {
        if (!curGroup) return;
        const msgLoc = collection(db, "group", curGroup.id, "messages")
        const q = query(msgLoc, orderBy("timestamp", "asc"), limit(20))
        const unsub = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({id: doc.id, ...doc.data() as any})))
        });
        // Stops updating when the group changes
        return () => unsub();
    }, [curGroup?.id])

    // Gets posts for a group when it is selected (not real-time)
    useEffect(() => {
        if (!curGroup) return;
        const load = async () => {
        const postsLoc = collection(db, "group", curGroup.id, "posts")
        const q = query(postsLoc);
        const posts = await getDocs(q);
        setPostss(posts.docs.map(p => ({id: p.id, ...p.data() as any})))
        // Stops listening when group is changed
}; load()}, [curGroup?.id])

    // Maps points to userIds so the status of a user is visible on a post
    const [pointMap, setPointMap] = useState<Record<string, number>>({})
    const results: Record<string, number> = {}

    // Gets the amount of points for each user with a post
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
        // Gets new points for any posts in case that user's points are unknown
    }; getUsers();}, [postss] )

    // Blank when no group selected
    if (!curGroup) return null;
    return(<div className='groupcontent'>
        <div className='groupinfo'>
        {/* Header with group name and id */}
        <h2>{curGroup?.name}</h2>
        <h4>Join ID: {curGroup?.id}</h4>
        </div>
        {/* Chat and posts are positioned next to each other under the header */}
        <div className='chatpost'>
        <div className='post'>
        <h2>User Posts</h2>
        <ul>
            {/* 10 Most recent posts are listed */}
            {postss.slice(0,10).map((p) => 
            <li className='postinst' key = {p.id}><b>{p.username}</b> Points: {pointMap[p.userId]} <></> <br/><br/> {p.content} <br/> posted on: {p.date.toDate().toDateString()} <br/> Congratulations: {p.likeIds.length}  <br/> <button className='createjoin' onClick={()=>handleLike(p)}>Congratulate</button></li>)}
        </ul>
        </div>
        <div className='chat'>
            <h2 className='title'>Group Chat</h2>
        <ul>
            {messages.map((m) =>
            <li key = {m.id}><b>{m.username}</b>: {m.content}</li>)}
        </ul>
        <div className='send'>
        {/* Messages can be send either with the send button or by pressing enter */}
        <input className='textzone' value={toSend} onChange={e => setToSend(e.target.value)} onKeyDown={e => {if (e.key === "Enter") sendMessage(toSend); }}/>
        <button className='viewbut' onClick={()=> sendMessage(toSend)}>Send</button>
        </div>
        </div>
        </div>
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