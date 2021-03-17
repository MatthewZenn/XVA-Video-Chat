import './style.css'
import firebase from 'firebase/app';
import 'firebase/firestore'

  const firebaseConfig = {
    apiKey: "AIzaSyAMYLuyBibCaZSR6TZQFp0yQdmim0pyaVQ",
    authDomain: "videochat-7e5e6.firebaseapp.com",
    projectId: "videochat-7e5e6",
    storageBucket: "videochat-7e5e6.appspot.com",
    messagingSenderId: "112022036516",
    appId: "1:112022036516:web:eec1779f18150c67f3b8b1",
    measurementId: "G-YVYCQFNNLP"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    //firebase.analytics();
  }

  const firestore = firebase.firestore();

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
      },
    ],
    iceCandidatePoolSize: 10,
  };

  let pc = new RTCPeerConnection(servers);
  let localStream = null;
  let remoteStream = null;

  const webcamButton = document.getElementById('webcamButton');
  const webcamVideo = document.getElementById('webcamVideo');
  const callButton = document.getElementById('callButton');
  const callInput = document.getElementById('callInput');
  const answerButton = document.getElementById('answerButton');
  const remoteVideo = document.getElementById('remoteVideo');
  const hangupButton = document.getElementById('hangupButton');

  webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;
  };

  callButton.onclick = async () => {
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    callInput.value = callDoc.id;

    pc.onicecandidate = event => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({offer});

    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDesciption = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDesciption);
      }
    });

    answerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pc.onicecandidate = event => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDesciption = await pc.createAnswer();
    await pc.setLocalDescription(answerDesciption);

    const answer = {
      type: answerDesciption.type,
      sdp: answerDesciption.sdp,
    };

    await callDoc.update({answer});

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log(change)
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

document.getElementById('copyButton').onclick = function() {
  document.getElementById('callInput').select();
  document.execCommand('copy');
}
