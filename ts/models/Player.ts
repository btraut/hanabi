export default interface Player {
	id: string;
	name: string;
	order?: number;
	connected: boolean;
	pictureData?: string;
};
