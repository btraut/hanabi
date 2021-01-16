import Heart from 'app/src/games/hanabi/client/icons/Heart';

interface Props {
	placeholder?: boolean;
}

export default function HanabiLife({ placeholder = false }: Props): JSX.Element {
	return <Heart color={placeholder ? '#cccccc' : '#ff0000'} size={30} />;
}
