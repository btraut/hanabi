export default function HanabiStyles(): JSX.Element {
	return (
		<style>{`
	
@keyframes border-dance {
	0% {
		background-position: left top, right bottom, left bottom, right top;
	}
	100% {
		background-position: left 15px top, right 15px bottom, left bottom 15px, right top 15px;
	}
}
.marquee-highlight {
	background-image:
		linear-gradient(90deg, yellow 50%, transparent 50%),
		linear-gradient(90deg, yellow 50%, transparent 50%),
		linear-gradient(0deg, yellow 50%, transparent 50%),
		linear-gradient(0deg, yellow 50%, transparent 50%);
	background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
	background-size: 15px 3px, 15px 3px, 3px 15px, 3px 15px;
	background-position: left top, right bottom, left bottom, right top;
	animation: border-dance 1s infinite linear;
}
	
@keyframes border-dance {
	0% {
		background-position: left top, right bottom, left bottom, right top;
	}
	100% {
		background-position: left 15px top, right 15px bottom, left bottom 15px, right top 15px;
	}
}

.shake {
	animation: shake 0.3s both infinite;
	transform: translate3d(0, 0, 0);
}
@keyframes shake {
	0% {
		transform: rotate(0);
	}
	25% {
		transform: rotate(2deg);
	}
	75% {
		transform: rotate(-2deg);
	}
	100% {
		transform: rotate(0);
	}
}

.text-rainbow {
	background: linear-gradient(to top, #3b83f6 24%, #10b981 36%, #f59f0b 66%, #f43f5d 76%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
}
.bg-rainbow {
	background: linear-gradient(to top, #3b83f6, #10b981, #f59f0b, #f43f5d);
}

	`}</style>
	);
}
