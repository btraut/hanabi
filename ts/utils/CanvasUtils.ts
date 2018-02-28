class CanvasUtils {
	private _tempCanvas: HTMLCanvasElement | null = null;
	private _tempContext: CanvasRenderingContext2D | null = null;

	public resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, newWidth: number, newHeight: number) {
		// Create a temp canvas.
		if (!this._tempCanvas) {
			this._tempCanvas = document.createElement('canvas');
			this._tempContext = this._tempCanvas.getContext('2d');
		}
		
		// Resize the temp canvas and copy the image. Note that
		// resizing it will clear its contents automatically.
		this._tempCanvas.width = canvas.width;
		this._tempCanvas.height = canvas.height;
		this._tempContext!.drawImage(canvas, 0, 0);
		
		// Resize the real canvas.
		canvas.width = newWidth;
		canvas.height = newHeight;
		
		// Restore the image to the real canvas.
		context.drawImage(this._tempCanvas, 0, 0);
	}
	
	public cloneCanvas(canvas: HTMLCanvasElement) {
		const newCanvas = document.createElement('canvas');
		const newContext = newCanvas.getContext('2d');
		
		newCanvas.width = canvas.width;
		newCanvas.height = canvas.height;
		newContext!.drawImage(canvas, 0, 0);
		
		return newCanvas;
	}
	
	public trimCanvasOld(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		
		const imageData = context!.getImageData(0, 0, canvas.width, canvas.height);
		
		const pixelsWithData = {
			left: Infinity,
			right: 0,
			minRow: Infinity,
			maxRow: 0
		};
		
		for (let y = 0; y < imageData.height; y += 1) {
			for (let x = 0; x < imageData.width; x += 1) {
				const index = (y * imageData.width + x) * 4;
				if (imageData.data[index + 3] > 0) {
					pixelsWithData.left = Math.min(pixelsWithData.left, x);
					pixelsWithData.right = Math.max(pixelsWithData.right, x);
					pixelsWithData.minRow = Math.min(pixelsWithData.minRow, y);
					pixelsWithData.maxRow = Math.max(pixelsWithData.maxRow, y);
				}   
			}
		}
		
		const newWidth = pixelsWithData.right - pixelsWithData.left;
		const newHeight = pixelsWithData.maxRow - pixelsWithData.minRow;
		
		console.log(pixelsWithData.minRow, pixelsWithData.left, newWidth, newHeight);
		
		const cut = context!.getImageData(pixelsWithData.minRow, pixelsWithData.left, newWidth, newHeight);
		
		canvas.width = newWidth;
		canvas.height = newHeight;
		context!.putImageData(cut, 0, 0);
	}
	
	public trimCanvas(canvas: HTMLCanvasElement) {
		const rowBlank = (imageData: ImageData, width: number, y: number) => {
			for (let x = 0; x < width; ++x) {
				if (imageData.data[y * width * 4 + x * 4 + 3] !== 0) {
					return false;
				}
			}
			
			return true;
		};
	
		const columnBlank = (imageData: ImageData, width: number, x: number, top: number, bottom: number) => {
			for (let y = top; y < bottom; ++y) {
				if (imageData.data[y * width * 4 + x * 4 + 3] !== 0) {
					return false;
				}
			}
			
			return true;
		};
		
		const context = canvas.getContext('2d');
		const width = canvas.width;
		const imageData = context!.getImageData(0, 0, canvas.width, canvas.height);
		
		let top = 0;
		let bottom = imageData.height;
		let left = 0;
		let right = imageData.width;

		while (top < bottom && rowBlank(imageData, width, top)) { ++top; }
		while (bottom - 1 > top && rowBlank(imageData, width, bottom - 1)) { --bottom; };
		while (left < right && columnBlank(imageData, width, left, top, bottom)) { ++left; }
		while (right - 1 > left && columnBlank(imageData, width, right - 1, top, bottom)) { --right; }

		const trimmed = context!.getImageData(left, top, right - left, bottom - top);
		canvas.width = trimmed.width;
		canvas.height = trimmed.height;
		context!.putImageData(trimmed, 0, 0);
	}
}

const instance = new CanvasUtils();
export default instance;
