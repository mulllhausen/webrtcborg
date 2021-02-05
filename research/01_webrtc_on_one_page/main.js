'use strict';

let peer1Connection;
let peer1Channel;

let peer2Connection;
let peer2Channel;

const servers = null;

function qRow(n) { return 'table#sendReceive tbody tr:nth-child(' + n + ')'; }
function qPeer(n) { return 'td:nth-child(' + (n + 1) + ')'; }

const peer1SDPSendTextarea = document.querySelector(
    qRow(1) + ' ' + qPeer(1) + ' textarea'
);
const peer1SDPReceiveTextarea = document.querySelector(
    qRow(2) + ' ' + qPeer(1) + ' textarea'
);
const peer1DataTextarea = document.querySelector(
    qRow(3) + ' ' + qPeer(1) + ' textarea'
);
const peer2SDPSendTextarea = document.querySelector(
    qRow(2) + ' ' + qPeer(2) + ' textarea'
);
const peer2SDPReceiveTextarea = document.querySelector(
    qRow(1) + ' ' + qPeer(2) + ' textarea'
);
const peer2DataTextarea = document.querySelector(
    qRow(3) + ' ' + qPeer(2) + ' textarea'
);
const startButton = document.querySelector('button#startButton');
const stopButton = document.querySelector('button#stopButton');

startButton.onclick = createConnections;
stopButton.onclick = closeDataChannels;
peer2SDPReceiveTextarea.onchange = onPeer2SDPReceiveTextarea;
peer1DataTextarea.onchange = onPeer1DataTextarea;
peer2DataTextarea.onchange = onPeer2DataTextarea;

function createConnections() {
    debugger;
    createPeer1Connection();
    createPeer2Connection();
    startButton.disabled = true;
    stopButton.disabled = false;
}

function createPeer1Connection() {
    peer1SDPSendTextarea.placeholder = '';
    peer1Connection = new RTCPeerConnection(servers);
    console.log('Created object peer1Connection');

    peer1Channel = peer1Connection.createDataChannel('sendDataChannel');
    console.log('Created object peer1Channel');

    peer1Connection.onicecandidate = function(e) {
        onIceCandidate(peer1Connection, e);
    };
    peer1Channel.onmessage = onPeer1Message;
    peer1Channel.onopen = onPeer1ChannelStateChange;
    peer1Channel.onclose = onPeer1ChannelStateChange;
    peer1Connection.createOffer().then(onPeer1SDP, onSDPError);
}

function createPeer2Connection() {
    peer2Connection = new RTCPeerConnection(servers);
    console.log('Created object peer2Connection');

    peer2Connection.onicecandidate = function(e) {
        onIceCandidate(peer2Connection, e);
    };
    peer2Connection.ondatachannel = onPeer2DataChannel;
}

function onSDPError(error) {
    console.log('Failed to create SDP: ' + error.toString());
}

function onPeer1DataTextarea() {
    peer1Channel.send(peer1DataTextarea.value);
    console.log('Sent Data: ' + peer1DataTextarea.value);
}

function onPeer2DataTextarea() {
    peer2Channel.send(peer2DataTextarea.value);
    console.log('Sent Data: ' + peer2DataTextarea.value);
}

function onPeer1SDP(rtcSessionDescription) {
    debugger;
    peer1Connection.setLocalDescription(rtcSessionDescription);
    console.log(`Offer from peer1Connection\n${rtcSessionDescription.sdp}`);
    peer1SDPSendTextarea.value = rtcSessionDescription.sdp;
    peer2SDPReceiveTextarea.disabled = false;
}

function onPeer2SDP(rtcSessionDescription) {
    debugger;
    peer2Connection.setLocalDescription(rtcSessionDescription);
    console.log(`Answer from peer2Connection\n${rtcSessionDescription.sdp}`);
    peer1Connection.setRemoteDescription(rtcSessionDescription);
}

function onPeer2SDPReceiveTextarea() {
    debugger;
    let rtcSessionDescription = new RTCSessionDescription();
    rtcSessionDescription.sdp = peer2SDPReceiveTextarea.value;
    rtcSessionDescription.type = 'offer';
    peer2Connection.setRemoteDescription(rtcSessionDescription);
    peer2Connection.createAnswer().then(onPeer2SDP, onSDPError);
}

function getOtherPeerConnection(peer) {
    return (peer === peer1Connection) ? peer2Connection : peer1Connection;
}

function getName(peer) {
    return (peer === peer1Connection) ? 'peer1Connection' : 'peer2Connection';
}

function onIceCandidate(rtcPeerConnection, e) {
    debugger;
    getOtherPeerConnection(rtcPeerConnection)
    .addIceCandidate(e.candidate)
    .then(
        onAddIceCandidateSuccess,
        onAddIceCandidateError
    );
    console.log(
        `${getName(rtcPeerConnection)} ICE candidate: ` +
        `${e.candidate ? e.candidate.candidate : '(null)'}`
    );
}

function onAddIceCandidateSuccess() {
    console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
    console.log(`Failed to add Ice Candidate: ${error.toString()}`);
}

function onPeer2DataChannel(e) {
    debugger;
    console.log('Peer 2 data channel');
    peer2Channel = e.channel;
    peer2Channel.onmessage = onPeer2Message;
    peer2Channel.onopen = onPeer2ChannelStateChange;
    peer2Channel.onclose = onPeer2ChannelStateChange;
}

function onPeer1Message(e) {
    console.log('Peer 1 received message');
    peer1DataTextarea.value = e.data;
}

function onPeer2Message(e) {
    console.log('Peer 2 received message');
    peer2DataTextarea.value = e.data;
}

function onPeer1ChannelStateChange() {
    debugger;
    const readyState = peer1Channel.readyState;
    console.log('Peer 1 channel state is: ' + readyState);
    if (readyState === 'open') {
        peer1DataTextarea.disabled = false;
        peer1DataTextarea.placeholder = 'type here now';
        peer2DataTextarea.disabled = false;
        peer2DataTextarea.placeholder = 'type here now';
        peer1DataTextarea.focus();
        stopButton.disabled = false;
    } else {
        peer1DataTextarea.disabled = true;
        peer2DataTextarea.disabled = true;
        stopButton.disabled = true;
    }
}

function onPeer2ChannelStateChange() {
    debugger;
    const readyState = peer2Channel.readyState;
    console.log(`Peer 2 channel state is: ${readyState}`);
}

function closeDataChannels() {
    debugger;
    console.log('Closing data channels');
    peer1Channel.close();
    console.log('Closed data channel with label: ' + peer1Channel.label);
    peer2Channel.close();
    console.log('Closed data channel with label: ' + peer2Channel.label);
    peer1Connection.close();
    peer2Connection.close();
    peer1Connection = null;
    peer2Connection = null;
    console.log('Closed peer connections');
    stopButton.disabled = true;
    peer1DataTextarea.value = '';
    peer2DataTextarea.value = '';
    peer1DataTextarea.disabled = true;
    peer2DataTextarea.disabled = true;
    startButton.disabled = false;
}
