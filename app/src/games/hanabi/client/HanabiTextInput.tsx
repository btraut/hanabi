import { ChangeEvent } from 'react';

interface Props {
	id?: string;
	value?: string;
	onChange?: (event: ChangeEvent) => void;
}

export default function HanabiTextInput({ onChange, value, id }: Props): JSX.Element {
	return (
		<input
			className="block px-3 py-2 bg-gray-900 border-4 border-white text-white w-full font-bold text-2xl"
			id={id}
			type="text"
			autoCorrect="off"
			autoCapitalize="none"
			onChange={onChange}
			value={value}
		/>
	);
}
