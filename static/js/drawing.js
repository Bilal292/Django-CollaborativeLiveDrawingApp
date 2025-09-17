document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('drawingCanvas'); // Get the canvas element
    const ctx = canvas.getContext('2d'); // Get the 2D drawing context
    let drawing = false;  // Indicates whether drawing is in progress
    let prevX = 0;  // Previous X coordinate for drawing
    let prevY = 0;  // Previous Y coordinate for drawing
    let currentColor = 'black';  // Current drawing color
    let drawingEnabled = false;  // Whether drawing is enabled
    const isAuthenticated = window.DjangoVars ? window.DjangoVars.isAuthenticated : false;
    let inkCounter = document.querySelector('.ink-counter');  // Element displaying the ink count
    let userInk = window.DjangoVars && window.DjangoVars.userInk ? parseInt(window.DjangoVars.userInk) : 0;  // Initialize with the current user's ink value
    let claimInkButton = document.getElementById('claimInkButton');
    let claimCountdown = document.getElementById('claimCountdown');
    let page = 1;  // Current page for chunked data loading
    let loading = false;  // Indicates whether data is currently being loaded

    // Function to draw a line on the canvas
    function drawLine(prevX, prevY, currX, currY, color) {
        ctx.beginPath();
        ctx.moveTo(prevX, prevY); // Move the "pen" to the starting point
        ctx.lineTo(currX, currY); // Draw a line to the new point
        ctx.strokeStyle = color; // Set the line color
        ctx.lineWidth = 2; // Set the line width
        ctx.stroke(); // Render the line
        ctx.closePath(); // Close the path to prevent issues with continuous drawing
    }

    // Function to load drawing data in chunks
    function loadDrawingDataChunk() {
        if (loading) return;  // Prevent concurrent data loading
        loading = true;

        fetch(`/drawing-data-chunks/?page=${page}`)
            .then(response => response.json())
            .then(data => {
                if (data.data.length > 0) {
                    data.data.forEach(draw => {
                        drawLine(draw.prevX, draw.prevY, draw.currX, draw.currY, draw.color);
                    });
                    page++;  // Move to the next page of data
                }
                loading = false;
                if (data.has_next) {
                    loadDrawingDataChunk();  // Load the next chunk if available
                }
            })
            .catch(error => {
                console.error('Error loading drawing data:', error);
                loading = false;
            });
    }

    // Start loading drawing data on page load
    loadDrawingDataChunk();

    // WebSocket setup for real-time drawing updates
    const ws_scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket('wss://shakalaka-app-hpce3.ondigitalocean.app/ws/drawing/');

    // Handle messages received by the server through WebSocket
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data); 
        if (data.error) {
            alert(data.error);
        } else {
            drawLine(data.prevX, data.prevY, data.currX, data.currY, data.color);

            // If ink data is included, update the user's ink counter
            if (data.ink !== undefined) {
                updateInkCounter(data.ink);
            }
        }
    };

    // Start drawing when mouse is pressed down on the canvas
    canvas.addEventListener('mousedown', (event) => {
        if (drawingEnabled) { //Allow drawing if drawing is enabled
            drawing = true;
            const rect = canvas.getBoundingClientRect();
            prevX = event.clientX - rect.left;
            prevY = event.clientY - rect.top;
        }
    });

    // Stop drawing when mouse is released
    canvas.addEventListener('mouseup', () => drawing = false);

    // Draw on the canvas as the mouse moves
    canvas.addEventListener('mousemove', (event) => {
        if (!drawing || !drawingEnabled) return;

        // Get the position of the canvas relative to the viewport (client area)
        const rect = canvas.getBoundingClientRect();
        // Calculate the current mouse position relative to the canvas
        const currX = event.clientX - rect.left;
        const currY = event.clientY - rect.top;

        // Check if the user still has ink to draw
        if (userInk > 0) {
            // Draw a line from the previous position (prevX, prevY) to the current position (currX, currY)
            drawLine(prevX, prevY, currX, currY, currentColor);

            // Send drawing data and current ink value to the server (triggers the recieve function in consumer.py)
            ws.send(JSON.stringify({
                'prevX': prevX,
                'prevY': prevY,
                'currX': currX,
                'currY': currY,
                'color': currentColor,
                'ink': userInk
            }));

            // Update local ink value and counter
            userInk -= 1;
            updateInkCounter(userInk);

            prevX = currX;
            prevY = currY;
        } else {
            alert('No ink left. Please refill.');
        }
    });

    // Add event listeners to color boxes for color selection
    document.querySelectorAll('.color-box').forEach(box => {
        box.addEventListener('click', () => {
            document.querySelectorAll('.color-box').forEach(box => {
                box.classList.remove('selected');
            });
            box.classList.add('selected');
            currentColor = box.getAttribute('data-color');
        });
    });

    // Toggle drawing mode on or off
    const toggleButton = document.getElementById('toggleDrawing');
    toggleButton.addEventListener('click', () => {
        if (isAuthenticated) {
            drawingEnabled = !drawingEnabled;
            if (drawingEnabled) {
                toggleButton.classList.remove('drawing-off');
                toggleButton.classList.add('drawing-on');
                toggleButton.textContent = 'Drawing On';
            } else {
                toggleButton.classList.remove('drawing-on');
                toggleButton.classList.add('drawing-off');
                toggleButton.textContent = 'Drawing Off';
            }
        } else {
            alert('Please log in to draw.');
        }
    });

    // Update the ink counter display
    function updateInkCounter(ink) {
        if (inkCounter) {
            inkCounter.textContent = `Draw Ink: ${ink}`;
        }
    }
    
    // Variables to Handle claiming process
    let claimTime = new Date(claimInkButton.getAttribute('data-next-claim'));
    let claimingInProgress = false; // Flag to indicate if the ink claim process is currently in progress

    claimInkButton.addEventListener('click', () => {
        if (claimingInProgress) return; // Prevent multiple claim attempts while a claim is already in progress

        claimingInProgress = true; // Set the flag to true to indicate the claiming process has started

        // Send a POST request to claim ink using the provided URL and CSRF token
        fetch(window.DjangoVars.claimInkUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.DjangoVars.csrfToken
            },
        })
        // Convert the server's response to JSON format
        .then(response => response.json())
        .then(data => {
            claimingInProgress = false; // Reset the claimingInProgress flag as the process has finished

            // If the ink claim was successful
            if (data.success) {
                // Update the user's ink amount and update the ink counter display
                userInk = data.ink;
                updateInkCounter(userInk);

                // Update the next claim time and restart the countdown
                claimTime = new Date(data.next_claim);
                startCountdown(claimTime);

                // Update button classes to reflect that the ink has been claimed
                claimInkButton.classList.add('claimed');
                claimInkButton.classList.remove('claimable');
            } else {
                // If the claim was not successful (but there is still a next claim time)
                // Update the next claim time and start the countdown again
                claimTime = new Date(data.next_claim);
                startCountdown(claimTime);

                // Ensure the button reflects that ink has already been claimed
                claimInkButton.classList.remove('claimable');
                claimInkButton.classList.add('claimed');
            }
        })
        .catch(error => {
            claimingInProgress = false;
            console.error('Error in INK Claiming');
        });
    });

    // Start the countdown for next ink claim
    function startCountdown(claimTime) {
        const now = new Date();
        if (now < claimTime) {
            updateCountdown(claimTime);
        } else {
            claimInkButton.classList.remove('claimed');
            claimInkButton.classList.add('claimable');
            claimCountdown.textContent = '';
        }
    }

    // Update the countdown timer for ink claim
    function updateCountdown(claimTime) {
        // Set an interval to update the countdown every second
        const interval = setInterval(() => {
            const now = new Date(); // Get the current time
            const diff = claimTime - now; // Calculate the time difference between now and the claim time
            
            // If the countdown has finished (i.e., time difference is 0 or less)
            if (diff <= 0) { 
                clearInterval(interval); // Stop the interval from running

                // Update the button to make it claimable and clear the countdown text
                claimInkButton.classList.remove('claimed'); 
                claimInkButton.classList.add('claimable'); 
                claimCountdown.textContent = '';
            } else {
                const hours = Math.floor(diff / 3600000);  // Calculate the hours remaining (1 hour = 3600000 ms)
                const minutes = Math.floor((diff % 3600000) / 60000);  // Calculate the minutes remaining (1 minute = 60000 ms)
                const seconds = Math.floor((diff % 60000) / 1000);  // Calculate the seconds remaining (1 second = 1000 ms)
                
                // Display the countdown in the format "HH:MM:SS"
                claimCountdown.textContent = `Claim Draw Ink - ${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;                
            }
        }, 1000);
    }

    // On page load, initialize the countdown if a valid next claim time is provided
    if (window.DjangoVars.nextClaimTime && window.DjangoVars.nextClaimTime !== 'None') {
        claimTime = new Date(window.DjangoVars.nextClaimTime);
        startCountdown(claimTime);
    } else {
        // If there is no next claim time, mark the button as claimable
        claimInkButton.classList.add('claimable');
    }
});
