enum ClientGameManagerState {
	Disconnected,
	Connecting,
	WaitingForInitialData,
	JoinGame,
	InGameLobby,
	NameYourself,
	DrawYourself,
	WaitingForGameToBegin,
	EnterText,
	WaitingForOthersToEnterText,
	DrawPicture,
	WaitingForOthersToDrawPicture,
	ReviewingSequences,
	PlayAgainOptions
}

export default ClientGameManagerState;
