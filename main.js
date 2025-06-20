import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Palette, Download, Share2, Eraser, PenTool, Square, Circle, Type, Undo, Redo, Save, Cloud } from 'lucide-react';

// Simulated WebSocket connection
class MockWebSocket {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.connected = true;
  }
  
  send(data) {
    // Simulate network delay
    setTimeout(() => {
      if (this.onMessage) {
        this.onMessage({ data: JSON.stringify({ ...JSON.parse(data), fromServer: true }) });
      }
    }, 50);
  }
  
  close() {
    this.connected = false;
  }
}

// Operational Transform implementation for conflict resolution
class OperationalTransform {
  static transformOperation(op1, op2) {
    // Simplified OT algorithm for demonstration
    if (op1.timestamp < op2.timestamp) {
      return { ...op2, transformed: true };
    }
    return { ...op1, transformed: true };
  }
}

const CollaborativeWhiteboard = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [activeUsers, setActiveUsers] = useState([
    { id: 'user1', name: 'You', color: '#3B82F6', cursor: { x: 0, y: 0 } }
  ]);
  const [operations, setOperations] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isSaving, setIsSaving] = useState(false);
  const wsRef = useRef(null);
  const contextRef = useRef(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // Initialize canvas and WebSocket connection
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Initialize mock WebSocket
    wsRef.current = new MockWebSocket((message) => {
      const data = JSON.parse(message.data);
      if (data.type === 'draw' && data.fromServer) {
        drawFromOperation(data);
      } else if (data.type === 'cursor') {
        updateUserCursor(data.userId, data.position);
      }
    });

    // Simulate other users joining
    setTimeout(() => {
      setActiveUsers(prev => [...prev, 
        { id: 'user2', name: 'Sarah Chen', color: '#10B981', cursor: { x: 100, y: 100 } },
        { id: 'user3', name: 'Alex Kumar', color: '#F59E0B', cursor: { x: 200, y: 150 } }
      ]);
    }, 2000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    lastPositionRef.current = { x, y };
    
    if (tool === 'pen' || tool === 'eraser') {
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const operation = {
      type: 'draw',
      tool,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
      from: lastPositionRef.current,
      to: { x, y },
      timestamp: Date.now(),
      userId: 'user1'
    };
    
    drawFromOperation(operation);
    
    // Send to "server"
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(operation));
    }
    
    setOperations(prev => [...prev, operation]);
    lastPositionRef.current = { x, y };
    
    // Broadcast cursor position
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor',
        userId: 'user1',
        position: { x, y }
      }));
    }
  };

  const drawFromOperation = (op) => {
    const ctx = contextRef.current;
    ctx.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = op.color;
    ctx.lineWidth = op.strokeWidth;
    
    ctx.beginPath();
    ctx.moveTo(op.from.x, op.from.y);
    ctx.lineTo(op.to.x, op.to.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const updateUserCursor = (userId, position) => {
    setActiveUsers(prev => 
      prev.map(user => 
        user.id === userId ? { ...user, cursor: position } : user
      )
    );
  };

  const undo = () => {
    if (operations.length === 0) return;
    
    const lastOp = operations[operations.length - 1];
    setRedoStack(prev => [...prev, lastOp]);
    setOperations(prev => prev.slice(0, -1));
    
    // Redraw canvas
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    operations.slice(0, -1).forEach(op => drawFromOperation(op));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    
    const redoOp = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setOperations(prev => [...prev, redoOp]);
    drawFromOperation(redoOp);
  };

  const clearCanvas = () => {
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setOperations([]);
    setRedoStack([]);
  };

  const saveCanvas = () => {
    setIsSaving(true);
    // Simulate save to cloud
    setTimeout(() => {
      setIsSaving(false);
      // In real implementation, this would save to Supabase
    }, 1000);
  };

  const downloadCanvas = () => {
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">Collaborative Whiteboard</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Active Users */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div className="flex -space-x-2">
                {activeUsers.map(user => (
                  <div
                    key={user.id}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: user.color }}
                    title={user.name}
                  >
                    {user.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={saveCanvas}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={isSaving}
            >
              {isSaving ? <Cloud className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            
            <button
              onClick={downloadCanvas}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 bg-white border-r border-gray-200 p-2 flex flex-col gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`p-3 rounded-md transition-colors ${
              tool === 'pen' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PenTool className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('eraser')}
            className={`p-3 rounded-md transition-colors ${
              tool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eraser className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('rectangle')}
            className={`p-3 rounded-md transition-colors ${
              tool === 'rectangle' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Square className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('circle')}
            className={`p-3 rounded-md transition-colors ${
              tool === 'circle' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Circle className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool('text')}
            className={`p-3 rounded-md transition-colors ${
              tool === 'text' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Type className="w-5 h-5" />
          </button>
          
          <hr className="my-2 border-gray-200" />
          
          <div className="relative group">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-10 rounded-md cursor-pointer"
            />
            <Palette className="w-4 h-4 text-gray-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:opacity-0 transition-opacity" />
          </div>
          
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-full p-2 text-sm border border-gray-200 rounded-md"
          >
            <option value="1">1px</option>
            <option value="2">2px</option>
            <option value="4">4px</option>
            <option value="8">8px</option>
          </select>
          
          <hr className="my-2 border-gray-200" />
          
          <button
            onClick={undo}
            className="p-3 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            disabled={operations.length === 0}
          >
            <Undo className="w-5 h-5" />
          </button>
          
          <button
            onClick={redo}
            className="p-3 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            disabled={redoStack.length === 0}
          >
            <Redo className="w-5 h-5" />
          </button>
          
          <button
            onClick={clearCanvas}
            className="mt-auto p-3 text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Eraser className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-gray-50 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full bg-white cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
          
          {/* User Cursors */}
          {activeUsers.slice(1).map(user => (
            <div
              key={user.id}
              className="absolute pointer-events-none transition-all duration-100"
              style={{
                left: user.cursor.x,
                top: user.cursor.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div 
                className="w-4 h-4 rounded-full opacity-80"
                style={{ backgroundColor: user.color }}
              />
              <span 
                className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ backgroundColor: user.color, color: 'white' }}
              >
                {user.name}
              </span>
            </div>
          ))}
        </div>

        {/* Right Sidebar - Activity Feed */}
        <div className="w-64 bg-white border-l border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
              <div>
                <span className="font-medium">Sarah Chen</span> joined the session
                <div className="text-gray-500 text-xs">2 minutes ago</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
              <div>
                <span className="font-medium">You</span> started drawing
                <div className="text-gray-500 text-xs">Just now</div>
              </div>
            </div>
          </div>
          
          <h3 className="font-medium text-gray-900 mt-6 mb-3">Permissions</h3>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span>Allow others to edit</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span>Show user cursors</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeWhiteboard;
