enum ClientGameManagerState {
	Disconnected,
	Connecting,
	WaitingForInitialData,
	InGameLobby,
	NameYourself,
	DrawYourself,
	WaitingForNextPhase,
	EnterText,
	WaitingForOthersToEnterText,
	DrawPicture,
	WaitingForOthersToDrawPicture,
	ReviewingSequences
}

export default ClientGameManagerState;
