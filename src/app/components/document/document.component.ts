import { Component, ViewChild, ElementRef, AfterViewInit, HostListener, CUSTOM_ELEMENTS_SCHEMA, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VeltService } from '../../services/velt.service';

@Component({
	selector: 'app-document',
	standalone: true,
	imports: [RouterOutlet],
	templateUrl: './document.component.html',
	styleUrl: './document.component.scss',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DocumentComponent implements AfterViewInit {
	@ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
	@ViewChild('htmlCanvas') htmlCanvasRef!: ElementRef<HTMLDivElement>;
	@ViewChild('veltComments') veltCommentsRef!: ElementRef<HTMLDivElement>;
	@ViewChild('test') test!: ElementRef<HTMLDivElement>;
	private ctx!: CanvasRenderingContext2D;
	private scale = 1; // Adjust this value to fit the shapes in the initial view
	private offsetX = -100; // Adjust this value to center the shapes horizontally
	private offsetY = -80; // Adjust this value to center the shapes vertically
	private isDragging = false;
	private lastX = 0;
	private lastY = 0;
	private zoomIntensity = 1.25;
	private minScale = 0.9;
	private maxScale = 1.5;
	private lastTouchDistance = 0;
	private isPanning = false;
	private startTouchX = 0;
	private startTouchY = 0;
	private circles: { x: number; y: number }[] = [];
	private dragThreshold = 5; // pixels
	private dragStartX = 0;
	private dragStartY = 0;
	private canvasWidth = 1000;
	private canvasHeight = 720;
	public htmlCanvasPosition = { x: 0, y: 0 };
	private clickedCanvasPosition = { x: 0, y: 0 }
	private htmlCanvasScale = 1; // New variable to store the scale
	private isPanningEnabled = true; // Variable to enable/disable panning
	private isZoomingEnabled = true; // Variable to enable/disable zooming

	private mouseX: number = 0;
	private mouseY: number = 0;
	// Getting Velt Client
	client = this.veltService.clientSignal();

	constructor(
		private authService: AuthService,
		private veltService: VeltService
	) {
		// Set Document when the velt client is initialized
		effect(() => {
			this.client = this.veltService.clientSignal();
			if (this.client) {
				// Contain your comments in a document by setting a Document ID & Name
				this.client.setDocument('canvas', { documentName: 'canvas' });

				this.client.setDarkMode(true)

				const commentElement = this.client?.getCommentElement()

				commentElement?.onCommentAdd().subscribe((event: any) => {
					const rect = this.canvasRef.nativeElement.getBoundingClientRect();

					const x = ((this.mouseX - rect.left - this.offsetX) / this.scale)
					const y = ((this.mouseY - rect.top - this.offsetY) / this.scale)

					event.detail?.addContext({ canvasCommentConfig: { id: 'sample-canvas-comment', position: { x, y } }, commentType: 'manual' });
					this.mouseX = 0
					this.mouseY = 0
				});
			}
		});
	}

	async ngOnInit(): Promise<void> {
		const commentElement = this.client?.getCommentElement()
		commentElement?.getAllCommentAnnotations().subscribe((commentAnnotations: any) => {
			this.renderCommentAnnotations(commentAnnotations)
		});
	}

	renderCommentAnnotations(commentAnnotations: any) {
		try {
			const commentsContainer = document.querySelector('.html-canvas');
			if (commentAnnotations) {
				commentAnnotations.forEach((commentAnnotation: any) => {
					if (!document.getElementById(`comment-pin-container-${commentAnnotation.annotationId}`) && commentAnnotation.context) {
						// Add Comment Pin if it doesn't exist
						const { x, y } = commentAnnotation.context.canvasCommentConfig.position;
						
						var commentPinContainer = document.createElement('div');
						commentPinContainer.className = 'comment-pin-container';
						commentPinContainer.id = `comment-pin-container-${commentAnnotation.annotationId}`;
						commentPinContainer.style.left = x + 'px';
						commentPinContainer.style.top = y + 'px';
						commentPinContainer.innerHTML = `<velt-comment-pin annotation-id="${commentAnnotation?.annotationId}"></velt-comment-pin>`;
						commentsContainer?.appendChild(commentPinContainer);
					}
				});
			}
		} catch (error) {
			console.error('97', error);
		}

	}

	ngAfterViewInit() {
		const canvas = this.canvasRef.nativeElement;
		this.ctx = canvas.getContext('2d')!;
		this.resizeCanvas();
		this.limitOffset(); // Add this line to ensure the initial offset is within bounds
		this.draw();
		this.updateHtmlCanvasPosition();
	}

	@HostListener('window:resize')
	onResize() {
		this.resizeCanvas();
		this.draw();
		this.updateHtmlCanvasPosition();
	}

	@HostListener('gesturechange', ['$event'])
	onGestureChange(event: any) {
		event.preventDefault();
		const scaleFactor = 1 - (1 - event.scale) * this.zoomIntensity;
		this.zoom(scaleFactor, event.clientX, event.clientY);
	}

	onWheel(event: WheelEvent) {
		if (!this.isZoomingEnabled) return; // Check if zooming is enabled

		event.preventDefault();
		const scaleFactor = 1 - event.deltaY * 0.001 * this.zoomIntensity;
		this.zoom(scaleFactor, event.clientX, event.clientY);
	}

	onTouchStart(event: TouchEvent) {
		if (event.touches.length === 2) {
			this.isPanning = true;
			this.startTouchX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
			this.startTouchY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
		} else if (event.touches.length === 1) {
			this.lastTouchDistance = 0;
		}
	}

	onTouchMove(event: TouchEvent) {
		if (!this.isPanningEnabled) return; // Check if panning is enabled

		event.preventDefault();
		if (event.touches.length === 2) {
			const currentX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
			const currentY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

			if (this.isPanning) {
				// Handle two-finger pan
				const dx = currentX - this.startTouchX;
				const dy = currentY - this.startTouchY;
				this.offsetX += dx;
				this.offsetY += dy;
				this.startTouchX = currentX;
				this.startTouchY = currentY;
			} else {
				// Handle pinch zoom
				const currentDistance = this.getTouchDistance(event.touches);
				if (this.lastTouchDistance > 0) {
					const scaleFactor = currentDistance / this.lastTouchDistance;
					this.zoom(scaleFactor, currentX, currentY);
				}
				this.lastTouchDistance = currentDistance;
			}

			this.draw();
			this.updateHtmlCanvasPosition();
		}
	}

	onTouchEnd() {
		this.isPanning = false;
		this.lastTouchDistance = 0;
		this.startTouchX = 0;
		this.startTouchY = 0;
	}

	private getTouchDistance(touches: TouchList): number {
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	zoom(scaleFactor: number, clientX: number, clientY: number) {
		if (!this.isZoomingEnabled) return; // Check if zooming is enabled

		const canvas = this.canvasRef.nativeElement;
		const rect = canvas.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;

		const newScale = Math.min(Math.max(this.scale * scaleFactor, this.minScale), this.maxScale);
		const factor = newScale / this.scale;

		this.offsetX = x - factor * (x - this.offsetX);
		this.offsetY = y - factor * (y - this.offsetY);
		this.scale = newScale;
		this.htmlCanvasScale = newScale; // Store the scale

		this.limitOffset();
		this.draw();
		this.updateHtmlCanvasPosition();
	}

	resizeCanvas() {
		const canvas = this.canvasRef.nativeElement;
		// canvas.width = window.innerWidth;
		// canvas.height = window.innerHeight;
		canvas.width = 800;
		canvas.height = 500;
	}

	draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		ctx.save();
		this.limitOffset();
		ctx.translate(this.offsetX, this.offsetY);
		ctx.scale(this.scale, this.scale);

		// Draw a border around the max area
		ctx.strokeStyle = '#00000000';
		ctx.lineWidth = 1 / this.scale;
		ctx.strokeRect(0, 0, this.canvasWidth, this.canvasHeight);

		// Draw existing shapes
		function drawPoly(cx: any, cy: any, spikes: any, outerRadius: any, innerRadius: any) {
			var rot = Math.PI / 2 * 3;
			var x = cx;
			var y = cy;
			var step = Math.PI / spikes;

			ctx.beginPath();
			ctx.moveTo(cx, cy - outerRadius)
			for (let i = 0; i < spikes; i++) {
				x = cx + Math.cos(rot) * outerRadius;
				y = cy + Math.sin(rot) * outerRadius;
				ctx.lineTo(x, y)
				rot += step

				x = cx + Math.cos(rot) * innerRadius;
				y = cy + Math.sin(rot) * innerRadius;
				ctx.lineTo(x, y)
				rot += step
			}
			ctx.lineTo(cx, cy - outerRadius);
			ctx.closePath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#FF4DF8';
			ctx.stroke();
		}

		drawPoly(320, 350, 5, 60, 30);

		// Draw rectangle
		ctx.beginPath()
		//ctx.fillStyle = '#03a9f4';  // Light blue
		ctx.rect(450, 300, 100, 100);
		ctx.strokeStyle = "#FF7162";
		ctx.lineWidth = 2;
		ctx.stroke()
		ctx.closePath()

		// Draw triangle
		ctx.beginPath();
		ctx.moveTo(400 + 270, 250 + 150);
		ctx.lineTo(350 + 270, 250 + 50);
		ctx.lineTo(450 + 270, 250 + 50);
		ctx.closePath();
		ctx.strokeStyle = "#FFEF00";
		ctx.lineWidth = 2;
		ctx.stroke()
		// ctx.fillStyle = '#4caf50';  // Green
		// ctx.fill();

		// Draw circles
		this.circles.forEach(circle => {
			this.drawCircle(circle.x, circle.y);
		});

		ctx.restore();
	}

	zoomIn() {
		const scaleFactor = 1.05; // 10% increase
		this.zoom(scaleFactor, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
	}

	zoomOut() {
		const scaleFactor = 0.95; // 10% decrease
		this.zoom(scaleFactor, this.ctx.canvas.width / 2, this.ctx.canvas.height / 2);
	}

	onMouseDown(event: MouseEvent) {
		this.isDragging = false;
		this.dragStartX = event.clientX;
		this.dragStartY = event.clientY;
		this.lastX = event.clientX;
		this.lastY = event.clientY;
	}

	onMouseMove(event: MouseEvent) {
		if (!this.isPanningEnabled) return; // Check if panning is enabled

		this.mouseX = event.clientX;
		this.mouseY = event.clientY;

		if (this.lastX !== 0 && this.lastY !== 0) {
			const dx = event.clientX - this.dragStartX;
			const dy = event.clientY - this.dragStartY;
			if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
				this.isDragging = true;
			}

			const movementX = event.clientX - this.lastX;
			const movementY = event.clientY - this.lastY;

			this.offsetX += movementX;
			this.offsetY += movementY;
			this.lastX = event.clientX;
			this.lastY = event.clientY;
			this.limitOffset();
			this.draw();
			this.updateHtmlCanvasPosition();
		}
	}

	onMouseUp() {
		this.lastX = 0;
		this.lastY = 0;
	}
	drawCircle(x: number, y: number) {
		this.ctx.beginPath();
		this.ctx.arc(x, y, 10, 0, 2 * Math.PI);
		this.ctx.strokeStyle = '#00FFFF';
		this.ctx.lineWidth = 2;
		this.ctx.stroke();
	}

	onClick(event: MouseEvent) {

		if (!this.isDragging) {
			const rect = this.canvasRef.nativeElement.getBoundingClientRect();
			const x = ((event.clientX - rect.left - this.offsetX) / this.scale);
			const y = ((event.clientY - rect.top - this.offsetY) / this.scale);
			// this.test.nativeElement.style.left = x + 'px'
			// this.test.nativeElement.style.top = y + 'px'

			// this.clickedCanvasPosition = { x: x - 20, y: y - 60 } // -20 for aligning the pin to center


			// Check if the click is on the canvas or html-canvas element
			if (event.target === this.canvasRef.nativeElement) {
				// Only add circles within the 3000x3000 area
				if (x >= 0 && x <= this.canvasWidth && y >= 0 && y <= this.canvasHeight) {
					this.circles.push({ x, y });

					this.draw();
				}
			}
		}
	}

	limitOffset() {
		const canvas = this.canvasRef.nativeElement;
		const maxOffsetX = Math.max(0, this.canvasWidth * this.scale - canvas.width);
		const maxOffsetY = Math.max(0, this.canvasHeight * this.scale - canvas.height);
		this.offsetX = Math.max(-maxOffsetX, Math.min(0, this.offsetX));
		this.offsetY = Math.max(-maxOffsetY, Math.min(0, this.offsetY));
	}

	updateHtmlCanvasPosition() {
		this.htmlCanvasPosition = {
			x: this.offsetX,
			y: this.offsetY
		};

		const htmlCanvas = this.htmlCanvasRef.nativeElement;
		htmlCanvas.style.transform = `translate(${this.htmlCanvasPosition.x}px, ${this.htmlCanvasPosition.y}px) scale(${this.htmlCanvasScale})`;
		// htmlCanvas.style.transform = `translate(${this.htmlCanvasPosition.x}px, ${this.htmlCanvasPosition.y}px)`;
	}

	resetCamera() {
		this.scale = 1;
		this.offsetX = -100;
		this.offsetY = -80;
		this.htmlCanvasScale = 1; // Reset the scale
		this.limitOffset();
		this.draw();
		this.updateHtmlCanvasPosition();
	}
}
