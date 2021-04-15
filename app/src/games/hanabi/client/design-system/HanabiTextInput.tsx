import { ChangeEvent, forwardRef, MutableRefObject } from 'react';

interface Props {
	id?: string;
	value?: string;
	onChange?: (event: ChangeEvent) => void;
	ref?: MutableRefObject<HTMLInputElement | null>;
}

function HanabiTextInput({ onChange, value, id }: Props, ref: any): JSX.Element {
	return (
		<input
			className="block px-3 py-2 bg-gray-900 border-4 border-white text-white w-full font-bold text-2xl focus:outline-none focus:border-red-600"
			id={id}
			type="text"
			autoCorrect="off"
			autoCapitalize="none"
			onChange={onChange}
			value={value}
			ref={ref}
		/>
	);
}

export default forwardRef<HTMLInputElement, Props>(HanabiTextInput);
