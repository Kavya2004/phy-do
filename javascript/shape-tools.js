// Shape Tools for Exact Drawing
class ShapeTools {
    constructor() {
        this.currentTool = 'freehand';
        this.isDrawing = false;
        this.startPoint = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.shapes = [];
        this.currentShape = null;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
    }

    updateCursor() {
        const canvas = window.teacherCanvas || window.studentCanvas;
        if (!canvas) return;

        const cursors = {
            freehand: 'crosshair',
            line: 'crosshair',
            rectangle: 'crosshair',
            circle: 'crosshair',
            triangle: 'crosshair',
            arrow: 'crosshair',
            text: 'text'
        };
        canvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    startDrawing(e, boardType) {
        const canvas = boardType === 'teacher' ? window.teacherCanvas : window.studentCanvas;
        const ctx = boardType === 'teacher' ? window.teacherCtx : window.studentCtx;
        
        if (!canvas || !ctx) return;

        this.isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        this.startPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY
        };

        if (this.currentTool === 'freehand') {
            ctx.beginPath();
            ctx.moveTo(this.startPoint.x, this.startPoint.y);
        } else {
            this.setupPreviewCanvas(canvas);
        }
    }

    draw(e, boardType) {
        if (!this.isDrawing) return;

        const canvas = boardType === 'teacher' ? window.teacherCanvas : window.studentCanvas;
        const ctx = boardType === 'teacher' ? window.teacherCtx : window.studentCtx;
        
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const currentPoint = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY
        };

        if (this.currentTool === 'freehand') {
            ctx.lineTo(currentPoint.x, currentPoint.y);
            ctx.stroke();
        } else {
            this.drawPreview(currentPoint);
        }
    }

    stopDrawing(boardType) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentTool !== 'freehand' && this.previewCanvas) {
            this.finalizeShape(boardType);
            this.clearPreview();
        }
    }

    setupPreviewCanvas(canvas) {
        if (!this.previewCanvas) {
            this.previewCanvas = document.createElement('canvas');
            this.previewCtx = this.previewCanvas.getContext('2d');
            this.previewCanvas.style.position = 'absolute';
            this.previewCanvas.style.pointerEvents = 'none';
            this.previewCanvas.style.zIndex = '1000';
            canvas.parentNode.appendChild(this.previewCanvas);
        }

        const rect = canvas.getBoundingClientRect();
        this.previewCanvas.width = canvas.width;
        this.previewCanvas.height = canvas.height;
        this.previewCanvas.style.left = rect.left + 'px';
        this.previewCanvas.style.top = rect.top + 'px';
        this.previewCanvas.style.width = canvas.offsetWidth + 'px';
        this.previewCanvas.style.height = canvas.offsetHeight + 'px';
    }

    drawPreview(currentPoint) {
        if (!this.previewCtx || !this.startPoint) return;

        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.strokeStyle = '#333';
        this.previewCtx.lineWidth = 2;
        this.previewCtx.setLineDash([5, 5]);

        switch (this.currentTool) {
            case 'line':
                this.drawLine(this.previewCtx, this.startPoint, currentPoint);
                break;
            case 'rectangle':
                this.drawRectangle(this.previewCtx, this.startPoint, currentPoint);
                break;
            case 'circle':
                this.drawCircle(this.previewCtx, this.startPoint, currentPoint);
                break;
            case 'triangle':
                this.drawTriangle(this.previewCtx, this.startPoint, currentPoint);
                break;
            case 'arrow':
                this.drawArrow(this.previewCtx, this.startPoint, currentPoint);
                break;
        }
    }

    finalizeShape(boardType) {
        const canvas = boardType === 'teacher' ? window.teacherCanvas : window.studentCanvas;
        const ctx = boardType === 'teacher' ? window.teacherCtx : window.studentCtx;
        
        if (!ctx || !this.startPoint) return;

        const rect = canvas.getBoundingClientRect();
        const currentPoint = {
            x: this.previewCanvas.width * (this.previewCanvas.offsetWidth / canvas.offsetWidth),
            y: this.previewCanvas.height * (this.previewCanvas.offsetHeight / canvas.offsetHeight)
        };

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        const endPoint = {
            x: currentPoint.x,
            y: currentPoint.y
        };

        switch (this.currentTool) {
            case 'line':
                this.drawLine(ctx, this.startPoint, endPoint);
                break;
            case 'rectangle':
                this.drawRectangle(ctx, this.startPoint, endPoint);
                break;
            case 'circle':
                this.drawCircle(ctx, this.startPoint, endPoint);
                break;
            case 'triangle':
                this.drawTriangle(ctx, this.startPoint, endPoint);
                break;
            case 'arrow':
                this.drawArrow(ctx, this.startPoint, endPoint);
                break;
        }

        // Mark that something was drawn
        if (typeof window.isAnythingDrawn !== 'undefined') {
            window.isAnythingDrawn = true;
        }
    }

    drawLine(ctx, start, end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    drawRectangle(ctx, start, end) {
        const width = end.x - start.x;
        const height = end.y - start.y;
        ctx.strokeRect(start.x, start.y, width, height);
    }

    drawCircle(ctx, start, end) {
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    drawTriangle(ctx, start, end) {
        const width = end.x - start.x;
        const height = end.y - start.y;
        
        ctx.beginPath();
        ctx.moveTo(start.x + width / 2, start.y); // Top point
        ctx.lineTo(start.x, end.y); // Bottom left
        ctx.lineTo(end.x, end.y); // Bottom right
        ctx.closePath();
        ctx.stroke();
    }

    drawArrow(ctx, start, end) {
        // Draw line
        this.drawLine(ctx, start, end);
        
        // Draw arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = 15;
        
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }

    clearPreview() {
        if (this.previewCanvas && this.previewCanvas.parentNode) {
            this.previewCanvas.parentNode.removeChild(this.previewCanvas);
            this.previewCanvas = null;
            this.previewCtx = null;
        }
    }

    addText(text, x, y, boardType) {
        const ctx = boardType === 'teacher' ? window.teacherCtx : window.studentCtx;
        if (!ctx) return;

        ctx.font = '16px Arial';
        ctx.fillStyle = '#333';
        ctx.fillText(text, x, y);
        
        if (typeof window.isAnythingDrawn !== 'undefined') {
            window.isAnythingDrawn = true;
        }
    }
}

// Initialize shape tools
window.shapeTools = new ShapeTools();

// Export for use in other modules
window.ShapeTools = ShapeTools;