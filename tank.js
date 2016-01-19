window.onload = function init() {
    openDataStore();
    var game = new GF();
    game.start();
};

// Variables for handling the storage of the gamepad configuration in the indexDB file
var db;   // database handle
var gamepad_config_records = [];
var DEFAULT_H_AXIS = 0, DEFAULT_Y_AXIS = 1;
var DEFAULT_FIRE_BUTTON = 0, DEFAULT_ROTATE_LEFT_BUTTON = 6, DEFAULT_ROTATE_RIGHT_BUTTON = 7; 

var GF = function () {
    // Vars relative to the canvas
    var canvas, ctx, canvasWidth, canvasHeight;

    // vars for counting frames/s, used by the measureFPS function
    var frameCount = 0;
    var lastTime;
    var fpsContainer;
    var fps;
    // for time based animation
    var delta, oldTime = 0;
    
    var lastLogtime = 0;   // for logging to the console every second rather than every frame

    // vars for handling inputs
    var inputStates = {};
    inputStates.left = false; 
    inputStates.right = false; 
    inputStates.up = false; 
    inputStates.down = false; 
    inputStates.newGame = true; 
    
    // gamepad support
    gamepad = [{
      id: "",
      connected: false,     // whether this gamepad is connected or not
      configured: false,    // if the config options have been presented
      playerIndex: null,    // player using this gamepad (player1 is index 0, player2 is index 1) or null if not being used
      navgamepad: null,     // the gamepad in navigator gamepads array
      horizontal: DEFAULT_H_AXIS,        // value of the button or axis
      vertical: DEFAULT_Y_AXIS, 
      fire: DEFAULT_FIRE_BUTTON,
      rotateLeft: DEFAULT_ROTATE_LEFT_BUTTON,
      rotateRight: DEFAULT_ROTATE_RIGHT_BUTTON
    }, {  
      id: "",
      connected: false,                    
      configured: false,     
      playerIndex: null,      
      index: 0,                               
      horizontal: DEFAULT_H_AXIS,    
      vertical: DEFAULT_Y_AXIS, 
      fire: DEFAULT_FIRE_BUTTON,
      rotateLeft: DEFAULT_ROTATE_LEFT_BUTTON,
      rotateRight: DEFAULT_ROTATE_RIGHT_BUTTON
    }];
    var numGamepads = 0;
    var redisplayGamepads = false;    // set if there's a gamepad connected or disconnected, to redo gamepad controls section of the web page
    var gamepadInputStates = [ {        // 2D array specifying the actions each gamepad user is taking
        inUse: false,
        fire: false,
        rotateLeft: false,
        rotateRight: false,
        horizontal: 0,
        vertical: 0 
        }, {
        inUse: false,
        fire: false,
        rotateLeft: false,
        rotateRight: false,
        horizontal: 0,
        vertical: 0 
        } ];
    var gamepadButtonsPressed = [];    // array which is used to keep track of what buttons each player has pressed on their gamepad
    var gamepadAxesPressed = [];       // array which is used to keep track of what axes each player has pressed on their gamepad

    // game states
    var numPlayers = 1;
    var player1UsingMouse = true; 
    var gameStates = {
        gameReady: 0,
        gameRunning: 1,
        gameOver: 2,
        gameWaitingForNextLevel: 3
    };
    var gameStarted = false; 
    var currentGameState = gameStates.gameOver;
    var currentLevel = 1;
    var currentScore = [0, 0];

    //var plopSound; // Sound of a ball exploding
    var PLOPSOUND_URL = 'http://mainline.i3s.unice.fr/mooc/plop.mp3';
    var PLOPSOUND = 0;
    //var explosionSound; // Sound of the tank exploding
    var EXPLOSIONSOUND_URL = 'https://raw.githubusercontent.com/robbiejackson/tank/master/audio/explosion.mp3';
    //var EXPLOSIONSOUND_URL = 'http://mainline.i3s.unice.fr/mooc/plop.mp3';
    var EXPLOSIONSOUND = 1; 
    // Sound of a shell being fired:
    var FIRESOUND_URL = 'http://mainline.i3s.unice.fr/mooc/shoot1.mp3';
    var FIRESOUND = 2; 
    var audioSound = [];
    var audioContext = window.AudioContext || window.webkitAudioContext;
    audio_ctx = new audioContext();
    
    //var TANK1_IMAGE_URL = "./images/T-34_top_view_vector-64px.svg.png";
    var TANK1_IMAGE_URL = "https://raw.githubusercontent.com/robbiejackson/tank/master/images/T-34_top_view_vector-64px.svg.png";
    var TANK2_IMAGE_URL = "https://raw.githubusercontent.com/robbiejackson/tank/master/images/T-34blue_top_view_vector-64px.svg.png";
    //var TANK2_IMAGE_URL = "./images/T-34blue_top_view_vector-64px.svg.png";
    //var TANKIMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/T-34_top_view_vector.svg/64px-T-34_top_view_vector.svg.png";
    var tankImage = [];  // tank is 64 x 90 pixels, centre is (24, 35)

    // The tank !
    var tank = [{
        destroyed: false,
        color: 'green',
        x: 0,  // used to keep track of where the image is. They're at the top left of the image 
        y: 0,  // only when the tank isn't rotated. They're just a fixed vector from the centre of the tank
        centreX: 0,  // (centreX, centreY) are the coordinates of the "centre" of the tank
        centreY: 0,  // rotation is done around this point, so these really reflect where the tank is
        angle: 0,    // current angle of rotation of tank
        width: 50,   // width of tank image (overwritten with real width)
        height: 50,  // height of tank image (overwritten with real height)
        diagonal: 50, // length of diagonal of tank image - used for calculating collisions with balls
        speedX: 0,   // current speed of tank in x direction
        speedY: 0,   // current speed of tank in y direction
        //speed: 100,  // fixed amount of how fast the tank goes in any direction
        //speed45deg: 70.7,  // component of speed 100 in X/Y directions when tank's going at 45 degrees
        lastShellFired: 0, // time the last shell was fired
        shellFiringDelay: 500  // how long you have to wait until you can fire another shell
    }, {
        destroyed: false,
        color: 'blue',
        x: 0,  // used to keep track of where the image is. They're at the top left of the image 
        y: 0,  // only when the tank isn't rotated. They're just a fixed vector from the centre of the tank
        centreX: 0,  // (centreX, centreY) are the coordinates of the "centre" of the tank
        centreY: 0,  // rotation is done around this point, so these really reflect where the tank is
        angle: 0,    // current angle of rotation of tank
        width: 50,   // width of tank image (overwritten with real width)
        height: 50,  // height of tank image (overwritten with real height)
        diagonal: 50, // length of diagonal of tank image - used for calculating collisions with balls
        speedX: 0,   // current speed of tank in x direction
        speedY: 0,   // current speed of tank in y direction
        //speed: 100,  // fixed amount of how fast the tank goes in any direction
        //speed45deg: 70.7,  // component of speed 100 in X/Y directions when tank's going at 45 degrees
        lastShellFired: 0, // time the last shell was fired
        shellFiringDelay: 500  // how long you have to wait until you can fire another shell
    } ];
    var turretRotationSpeed = 5;  // how fast the turret rotates (applicable to gamepads only)
    var tankSpeed = 0;            // fixed amount of how fast the tank goes in any direction
    var tankSpeed45deg = 70.7;    // component of speed 100 in X/Y directions when tank's going at 45 degrees
    var TANK_CENTRE_OFFSET_X = 24;   // offsets from top left of tank image to tank centre
    var TANK_CENTRE_OFFSET_Y = 35;   // tank centre is the centre round which the tank rotates

    // array of balls to animate
    var ballArray = [];
    var BALL_DYING_TIME = 100;
    var numInitialBalls = 0;
    var numBallsThisLevel = 0;
    var initialAveSpeedBalls = 0;    // set from config
    var aveSpeedBalls = 0;           // this increases on each level
    var BALL_INCREASE_SPEED_FACTOR = 1.2;   // factor by which the ball speed increases in each successive level
    
    // array of shells
    var shellArray = [];
    var numShells = 0;
    

    // We want the object to move at speed pixels/s (there are 60 frames in a second)
    // If we are really running at 60 frames/s, the delay between frames should be 1/60
    // = 16.66 ms, so the number of pixels to move = (speed * del)/1000. If the delay is twice
    // longer, the formula works : let's move the rectangle twice longer!
    var calcDistanceToMove = function (delta, speed) {
        //console.log("#delta = " + delta + " speed = " + speed);
        return (speed * delta) / 1000;
    };

    var measureFPS = function (newTime) {

        // test for the very first invocation
        if (lastTime === undefined) {
            lastTime = newTime;
            return;
        }

        //calculate the difference between last & current frame
        var diffTime = newTime - lastTime;

        if (diffTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = newTime;
        }

        //and display it in an element we appended to the 
        // document in the start() function
        fpsContainer.innerHTML = 'FPS: ' + fps;
        frameCount++;
    };
    
    function aSecondHasElapsed() {
      var timenow = performance.now(); 
      if (timenow - lastLogtime > 1000) {
        lastLogtime = timenow; 
        return true; 
      } else {
        return false;
      }
    }

    // clears the canvas content
    function clearCanvas() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    // Functions for drawing the tank and maybe other objects
    function drawMyTank(i, x, y, angle) {
        if (tank[i].destroyed) return;
        // tank is 64 x 90 pixels, centre is (24, 35)
        // head

        // save the context
        ctx.save();

        // translate and rotate the coordinate system, draw relative to it
        ctx.translate(x + TANK_CENTRE_OFFSET_X, y + TANK_CENTRE_OFFSET_Y);
        ctx.rotate(angle);
        ctx.translate(-TANK_CENTRE_OFFSET_X, -TANK_CENTRE_OFFSET_Y);
        
        ctx.drawImage(tankImage[i], 0, 0);

        // restore the context
        ctx.restore();
    }

    function timer(currentTime) {
        var delta = currentTime - oldTime;
        oldTime = currentTime;
        return delta;

    }
    var mainLoop = function (time) {
        var i; 
        //main function, called each frame 
        measureFPS(time);

        // number of ms since last frame draw
        delta = timer(time);

        // Clear the canvas
        clearCanvas();
        
        navgamepads = navigator.getGamepads();
        if (navgamepads.length != numGamepads || redisplayGamepads) {
          // number of connected gamepads has changed - display config on web page
          console.log("updating gamepad config");
          redisplayGamepads = false; 
          updateGamepadConfig(navgamepads);
          numGamepads = navgamepads.length;
        }
        mapGamepadInputStates(navgamepads);
        
        if (tank[0].destroyed && tank[1].destroyed) {
            currentGameState = gameStates.gameOver;
        }

        switch (currentGameState) {
            case gameStates.gameReady:

                // update and draw balls
                updateBalls(delta);

                if (numPlayers > 1) {
                  ctx.fillText("Click to position the tanks!", 50, 150);
                } else {
                  ctx.fillText("Click to position the tank!", 50, 150);
                }
                if (inputStates.mousedown) { // position the tank
                    tank[0].centreX = inputStates.mousePos.x;
                    tank[0].centreY = inputStates.mousePos.y; 
                    tank[0].x = tank[0].centreX - TANK_CENTRE_OFFSET_X;
                    tank[0].y = tank[0].centreY - TANK_CENTRE_OFFSET_Y;
                    if (numPlayers > 1) {    // position the second tank in the same position as the first
                      tank[1].centreX = inputStates.mousePos.x;
                      tank[1].centreY = inputStates.mousePos.y; 
                      tank[1].x = tank[1].centreX - TANK_CENTRE_OFFSET_X;
                      tank[1].y = tank[1].centreY - TANK_CENTRE_OFFSET_Y;
                    }
                    currentGameState = gameStates.gameRunning;
                }
                
                highlightGamepadControls(navgamepads); 
            
                displayScore();
                
/*
                // decrease currentLevelTime. 
                // When < 0 go to next level
                currentLevelTime -= delta;

                if (currentLevelTime < 0) {
                    goToNextLevel();
                }
*/
                break;
            case gameStates.gameRunning:
                //mapGamepadInputStates(navgamepads);
                var now = performance.now();
                var shell;
                if (player1UsingMouse && inputStates.mousePos) {
                  // this controls where the tank is pointing
                  // work out the angle of the tank - it's pointing towards the mouse 
                  // Math.atan(x) returns the angle between -pi/2 (at -infinity) and pi/2 (at +infinity)
                  if (inputStates.mousePos.y < tank[0].centreY) {  // ie above the tank
                    tank[0].angle = Math.atan( 1.0 * (inputStates.mousePos.x - tank[0].centreX) / 
                        (tank[0].centreY - inputStates.mousePos.y) );
                  } else if (inputStates.mousePos.y > tank[0].centreY) { // ie below the tank 
                    tank[0].angle = Math.PI - Math.atan( 1.0 * (inputStates.mousePos.x - tank[0].centreX) / 
                        (inputStates.mousePos.y - tank[0].centreY) );
                  } else if (inputStates.mousePos.x > tank[0].centreX) {  // mouse on the horizontal line through tank, to the right
                    tank[0].angle = Math.PI/2;
                  } else if (inputStates.mousePos.x > tank[0].centreX) {
                    tank[0].angle = - Math.PI/2;
                  } else {  // you get this condition at the start, because click to position the tank continues to next frame
                    tank[0].angle = 0;
                  }
                  //console.log("tank angle is ", tank.angle);
                }
                if (player1UsingMouse && inputStates.mousedown) {   // fire a shell
                  //console.log("firing a shell");
                  if (now - tank[0].lastShellFired > tank[0].shellFiringDelay) {
                    //console.log("firing a shell");
                    shell = new Shell(0, tank[0].centreX, tank[0].centreY, tank[0].speedX, tank[0].speedY, tank[0].angle, tank[0].color);
                    shellArray[numShells++] = shell;
                    tank[0].lastShellFired = now; 
                    playSound(audioSound[FIRESOUND]);
                  }
                }
                
                for (i = 0; i < numPlayers; i++) {
                  if (!gamepadInputStates[i].inUse) continue; 
                  if (gamepadInputStates[i].fire) {   // fire a shell
                    if (now - tank[i].lastShellFired > tank[i].shellFiringDelay) {
                      //console.log("Player ", i, " firing a shell");
                      shell = new Shell(i, tank[i].centreX, tank[i].centreY, tank[i].speedX, tank[i].speedY, tank[i].angle, tank[i].color);
                      shellArray[numShells++] = shell;
                      tank[i].lastShellFired = now; 
                      playSound(audioSound[FIRESOUND]);
                    }
                  }
                }
                
                for (i = 0; i < numPlayers; i++) {
                  if (!gamepadInputStates[i].inUse) continue; 
                  if (gamepadInputStates[i].rotateRight) {
                    tank[i].angle += turretRotationSpeed / 360.0; 
                  }
                  if (gamepadInputStates[i].rotateLeft) {
                    tank[i].angle -= turretRotationSpeed / 360.0; 
                  }
                }


                // draw the tank
                for (i = 0; i < numPlayers; i++) {
                  drawMyTank(i, tank[i].x, tank[i].y, tank[i].angle);
                }
                

                // Check inputs and move the tank
                updateTankPosition(delta);

                // update and draw balls
                updateBalls(delta);
                
                updateShells(delta);
                
                testShellCollisionWithWalls();
                
                displayScore();
                
                if (levelComplete()) {
                  if (numPlayers == 1) {
                    currentScore[0] += currentLevel * 10; 
                  } else {   // 2 player game - add bonus to player(s) whose tank is still alive
                    if (!tank[0].destroyed) currentScore[0] += currentLevel * 10;
                    if (!tank[1].destroyed) currentScore[1] += currentLevel * 10;
                  }
                  currentGameState = gameStates.gameWaitingForNextLevel;
                  setTimeout(goToNextLevel, 2000);
                }
/*
                // decrease currentLevelTime. 
                // When < 0 go to next level
                currentLevelTime -= delta;

                if (currentLevelTime < 0) {
                    goToNextLevel();
                }
*/
                break;
/*
            case gameStates.mainMenu:
                // TO DO !
                break;
*/
            case gameStates.gameOver:

                if (gameStarted) {
                  if (numPlayers == 1) {
                    ctx.fillText("Game over! Total score " + currentScore[0], 50, 100);
                  } else {   // 2 player game
                    ctx.fillText("Game over! Player 1 score " + currentScore[0] + "    Player 2 score " + currentScore[1], 50, 100);
                  }
                }
                
                highlightGamepadControls(navgamepads); 
                
                if (inputStates.newGame) {
                  gameStarted = true; 
                  aveSpeedBalls = initialAveSpeedBalls;
                  createBalls(numInitialBalls);
                  numBallsThisLevel = numInitialBalls; 
                  tank[0].destroyed = false; 
                  tank[1].destroyed = false; 
                  currentGameState = gameStates.gameReady;
                  inputStates.newGame = false; 
                  currentScore = [0, 0];
                }

                break;
                
            case gameStates.gameWaitingForNextLevel:
            
                ctx.fillText("Congratulations, level complete! Bonus " + currentLevel * 10, 50, 150);
                displayScore();
                
                break; 
        }

        // call the animation loop every 1/60th of second
        requestAnimationFrame(mainLoop);
    };
/*
    function startNewGame() {
        nbBalls = 5;
        createBalls(nbBalls);
        currentGameState = gameStates.gameReady;
    }
*/
    function levelComplete() { // when all the balls in the array are equal to null
      for (var i = 0; i < ballArray.length; i++) {
        if (ballArray[i]) return false;
      }
      return true;
    }

    function goToNextLevel() {
        // reset time available for next level
        // 5 seconds in this example
        console.log("Going to the next level");
        //currentLevelTime = 5000;
        currentLevel++;
        // Add 5 balls per level
        numBallsThisLevel = numBallsThisLevel + 5;  
        // and increase the average speed
        aveSpeedBalls *= BALL_INCREASE_SPEED_FACTOR;
        createBalls(numBallsThisLevel);
        currentGameState = gameStates.gameReady;
    }

    function displayScore() {
        document.getElementById('score1').innerHTML = currentScore[0]; 
        document.getElementById('score2').innerHTML = currentScore[1];
        document.getElementById('level').innerHTML = currentLevel; 
    }
    
    function mapGamepadInputStates(navgamepads) {
      // this function maps what buttons etc have been pressed on the gamepads to the gamepadInputStates 
      // which specifies what each player is wanting to do 
      //var logging = aSecondHasElapsed();
      var logging = false; 
      if (logging) {
        console.log("in mapGamepadInputStates(navgamepads) at time ", performance.now());
        console.log("gamepad[0]: ", gamepad[0]);
        console.log("gamepad[1]: ", gamepad[1]);
      }
      gamepadInputStates[0].inUse = gamepadInputStates[1].inUse = false; 
      for (var i = 0; i < navgamepads.length; i++) {
        if (!navgamepads[i] || !navgamepads[i].connected) continue; 
        var playerIndex = gamepad[i].playerIndex;   // the player that's using this gamepad
        if (playerIndex == null) continue;          // in case the player for this gamepad hasn't been set
        gamepadInputStates[playerIndex].inUse = true; 
        gamepadInputStates[playerIndex].fire = navgamepads[i].buttons[gamepad[i].fire].pressed; 
        gamepadInputStates[playerIndex].rotateRight = navgamepads[i].buttons[gamepad[i].rotateRight].pressed; 
        gamepadInputStates[playerIndex].rotateLeft = navgamepads[i].buttons[gamepad[i].rotateLeft].pressed; 
        gamepadInputStates[playerIndex].horizontal = navgamepads[i].axes[gamepad[i].horizontal]; 
        gamepadInputStates[playerIndex].vertical = navgamepads[i].axes[gamepad[i].vertical]; 
        if (logging) {
          console.log("mapping for gamepad ", i, ", player ", playerIndex);
          console.log("Fire: ", gamepadInputStates[playerIndex].fire, "Rotate right ", gamepadInputStates[playerIndex].rotateRight,
            "Rotate left ", gamepadInputStates[playerIndex].rotateLeft);
          console.log("Horizontal: ", gamepadInputStates[playerIndex].horizontal, ", Vertical: ", gamepadInputStates[playerIndex].vertical);
        }
      }
      
    }

    function updateTankPosition(delta) {
        var i; 
        tank[0].speedX = tank[0].speedY = 0;
        // check inputStates
        if (player1UsingMouse) {
            if (inputStates.left && !inputStates.right && !inputStates.up && !inputStates.down) {
                tank[0].speedX = -tankSpeed;
            }
            if (!inputStates.left && inputStates.right && !(inputStates.up) && !(inputStates.down)) {
                tank[0].speedX = tankSpeed;
            }
            if (!inputStates.left && !inputStates.right && inputStates.up && !inputStates.down) {
                tank[0].speedY = -tankSpeed;
            }
            if (!inputStates.left && !inputStates.right && !inputStates.up && inputStates.down) {
                tank[0].speedY = tankSpeed;
            }
            if (inputStates.left && !inputStates.right && inputStates.up && !inputStates.down) {
                tank[0].speedX = -tankSpeed45deg;
                tank[0].speedY = -tankSpeed45deg;
            }
            if (inputStates.left && !inputStates.right && !inputStates.up && inputStates.down) {
                tank[0].speedX = -tankSpeed45deg;
                tank[0].speedY = tankSpeed45deg;
            }
            if (!inputStates.left && inputStates.right && inputStates.up && !inputStates.down) {
                tank[0].speedX = tankSpeed45deg;
                tank[0].speedY = -tankSpeed45deg;
            }
            if (!inputStates.left && inputStates.right && !inputStates.up && inputStates.down) {
                tank[0].speedX = tankSpeed45deg;
                tank[0].speedY = tankSpeed45deg;
            }
            if ((inputStates.left && inputStates.right) || (inputStates.up && inputStates.down)) {
                // invalid - leave stationary
            }
            if (inputStates.space) {
            }
            if (inputStates.mousePos) {
            }
        }
        for (i = 0; i < numPlayers; i++) {
          if (gamepadInputStates[i].inUse) {
            tank[i].speedX = tankSpeed * gamepadInputStates[i].horizontal; 
            tank[i].speedY = tankSpeed * gamepadInputStates[i].vertical; 
          }
        }

        // Compute the incX and inY in pixels depending
        // on the time elasped since last redraw
        for (i = 0; i < numPlayers; i++) {
          tank[i].x += calcDistanceToMove(delta, tank[i].speedX);
          tank[i].y += calcDistanceToMove(delta, tank[i].speedY);
          tank[i].centreX = tank[i].x + TANK_CENTRE_OFFSET_X;
          tank[i].centreY = tank[i].y + TANK_CENTRE_OFFSET_Y;
          testTankCollisionWithWalls(i);
        }    
    }
    
    function testTankCollisionWithWalls(i) {
        // left
        if (tank[i].centreX < 0) {
            tank[i].centreX = 0;
            tank[i].x = tank[i].centreX - TANK_CENTRE_OFFSET_X;
        }
        // right
        if (tank[i].centreX > canvasWidth) {
            tank[i].centreX = canvasWidth;
            tank[i].x = tank[i].centreX - TANK_CENTRE_OFFSET_X;
        }
        // up
        if (tank[i].centreY < 0) {
            tank[i].centreY = 0;
            tank[i].y = tank[i].centreY - TANK_CENTRE_OFFSET_Y;
        }
        // down
        if (tank[i].centreY > canvasHeight) {
            tank[i].centreY = canvasHeight;
            tank[i].y = tank[i].centreY - TANK_CENTRE_OFFSET_Y;
        }
    }


    function updateBalls(delta) {
        // Move and draw each ball, test collisions, 
        for (var i = 0; i < ballArray.length; i++) {
            if (!ballArray[i]) continue;   // skip loop if ball has already been destroyed
            if (ballArray[i].ballHitAt) {
              if (performance.now() - ballArray[i].ballHitAt > BALL_DYING_TIME) {
                //console.log("removing ball ", i);
                ballArray[i] = null; 
                continue;
              }
            }
            var ball = ballArray[i];

            // 1) move the ball
            ball.move();

            // 2) test if the ball collides with a wall
            testBallCollisionWithWalls(ball);

            // Test if the monster collides
            /*
            if (circRectsOverlap(monster.x, monster.y,
                    monster.width, monster.height,
                    ball.x, ball.y, ball.radius)) {

                //change the color of the ball
                ball.color = 'red';
                monster.destroyed = true;
                // Here, a sound effect greatly improves
                // the experience!
                plopSound.play();
            }
            */
            if (currentGameState == gameStates.gameRunning && !ballArray[i].ballHitAt) {
                if (ballTankCollision(tank[0].centreX, tank[0].centreY, tank[0].angle, tank[0].diagonal, ball.x, ball.y, ball.radius)) {
                  console.log("Player1 tank destroyed");
                  playSound(audioSound[EXPLOSIONSOUND]);
                  tank[0].destroyed = true;
                }
                if (numPlayers > 1) {
                  if (ballTankCollision(tank[1].centreX, tank[1].centreY, tank[1].angle, tank[1].diagonal, ball.x, ball.y, ball.radius)) {
                    console.log("Player2 tank destroyed");
                    playSound(audioSound[EXPLOSIONSOUND]);
                    tank[1].destroyed = true;
                  }
                }
                if ((numPlayers == 1 && tank[0].destroyed) || (numPlayers == 2 && tank[0].destroyed && tank[1].destroyed)) {
                  currentGameState = gameStates.gameOver;
                }
            }

            // 3) draw the ball
            ball.draw();
        }
    }

    function ballTankCollision(tankCentreX, tankCentreY, tankAngle, tankDiagonal, ballX, ballY, ballRadius) {

      // first of all test if the ball touches a bounding ball round the tank, 
      // centred on tankX, tankY with radius = diagonal of tank image
      if ( (tankCentreX-ballX)*(tankCentreX-ballX) + (tankCentreY-ballY)*(tankCentreY-ballY) > (ballRadius+tankDiagonal)*(ballRadius+tankDiagonal)) {
        //console.log("not colliding with tank");
        return false;
      }
      // tank has been rotated clockwise about tank.angle radians. 
      // to test for collisions, rotate back anticlockwise to align the sides of the rectangles parallel to the axes
      // This means rotating the ball about the tank centre position. This is calculated by multiplying the vector
      // from (tankCentreX, tankCentreY) to the ball centre by the matrix   ( cos A  -sin A )
      //                                                                    ( sin A   cos A )
      // First, change to normal x,y coordinates ie, y up instead of down, to keep me sane
      ballY2 = canvasHeight - ballY;
      tankCentreY2 = canvasHeight - tankCentreY; 
      ballRotatedX = tankCentreX + Math.cos(tankAngle) * (ballX - tankCentreX) - Math.sin(tankAngle) * (ballY2 - tankCentreY2);
      ballRotatedY2 = tankCentreY2 + Math.sin(tankAngle) * (ballX - tankCentreX) + Math.cos(tankAngle) * (ballY2 - tankCentreY2);
      ballRotatedY = canvasHeight - ballRotatedY2;
      // now the rotated ball is at (ballRotatedX, ballRotatedY)
      //console.log("testing for ", tankCentreX, tankCentreY, tankAngle, ballX, ballY, ballRadius);
      //console.log("new coordinates are ", ballRotatedX, ballRotatedY);
      // we test if the ball collides with the main body of the tank, not the whole tank image
      // wrt the top left corner of the tank image this is (11, 16), (37, 16), (11, 58), (37, 58), ie width 26, height 42
      // so wrt the tank centre (24,35) the top left of the main body of the tank is at (-13,-19)
      return circRectsOverlap(tankCentreX - 13, tankCentreY - 19, 26, 42, ballRotatedX, ballRotatedY, ballRadius);
      
      //return rectangleSphereCollision({x: tankX + 11, y: tankY + 16}, 
    }
    
    // Collisions between rectangle and circle
    function circRectsOverlap(x0, y0, w0, h0, cx, cy, r) {
        var testX = cx;
        var testY = cy;

        if (testX < x0)
            testX = x0;
        if (testX > (x0 + w0))
            testX = (x0 + w0);
        if (testY < y0)
            testY = y0;
        if (testY > (y0 + h0))
            testY = (y0 + h0);

        return (((cx - testX) * (cx - testX) + (cy - testY) * (cy - testY)) < r * r);
    }


    function testBallCollisionWithWalls(ball) {
        // left
        if (ball.x < ball.radius) {
            ball.x = ball.radius;
            ball.angle = -ball.angle + Math.PI;
        }
        // right
        if (ball.x > canvasWidth - (ball.radius)) {
            ball.x = canvasWidth - (ball.radius);
            ball.angle = -ball.angle + Math.PI;
        }
        // up
        if (ball.y < ball.radius) {
            ball.y = ball.radius;
            ball.angle = -ball.angle;
        }
        // down
        if (ball.y > canvasHeight - (ball.radius)) {
            ball.y = canvasHeight - (ball.radius);
            ball.angle = -ball.angle;
        }
    }

    function getMousePos(evt) {
        // necessary to take into account CSS boudaries
        var rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function createBalls(numberOfBalls) {
        // Start from an empty array
        ballArray = [];
        console.log("Creating ", numberOfBalls, " balls");

        for (var i = 0; i < numberOfBalls; i++) {
            // Create a ball with random position and speed. 
            // You can change the radius
            var ball = new Ball(canvasWidth * Math.random(),
                    canvasHeight * Math.random(),
                    (2 * Math.PI) * Math.random(),
                    (aveSpeedBalls * Math.random()),
                    30);
            ballArray[i] = ball; 
            // Do not create a ball on the player. We augmented the ball radius 
            // to sure the ball is created far from the monster. 
            /*
            if (!circRectsOverlap(monster.x, monster.y,
                    monster.width, monster.height,
                    ball.x, ball.y, ball.radius * 3)) {
                // Add it to the array
                ballArray[i] = ball;
            } else {
                i--;
            }
            */


        }
    }
// constructor function for balls
    function Ball(x, y, angle, v, diameter) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.v = v;
        this.radius = diameter / 2;
        this.color = 'black';
        this.ballHitAt = null;   // time that the ball was hit by a shell
          // keep track of this so that we can change its colour for a short while after it's been hit, before it disappears
        //console.log("Creating ball at ", x, ", ", y);

        this.draw = function () {
            //console.log("Drawing ball at ", this.x, ", ", this.y);
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = this.color;
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
        };

        this.move = function () {
            // add horizontal increment to the x pos
            // add vertical increment to the y pos

            var incX = this.v * Math.cos(this.angle);
            var incY = this.v * Math.sin(this.angle);

            this.x += calcDistanceToMove(delta, incX);
            this.y += calcDistanceToMove(delta, incY);
        };
    }

// constructor function for shells
    function Shell(playerIndex, tankCentreX, tankCentreY, tankSpeedX, tankSpeedY, tankAngle, tankColor) {
      // shell is a rectangle 2px x 8px
      // start from the front of the tank cannon
      // rotation of tank is about tank centre (24, 35), and in relation to this top of cannon is (-1, -35)
      // rotation of the tank -> rotation of image of shell 
        //console.log("in Shell with params", playerIndex, tankCentreX, tankCentreY, tankSpeedX, tankSpeedY, tankAngle, tankColor);
        this.x = tankCentreX + Math.sin(tankAngle) * TANK_CENTRE_OFFSET_Y - Math.cos(tankAngle) * (1.0);
        this.y = tankCentreY - Math.cos(tankAngle) * TANK_CENTRE_OFFSET_Y - Math.sin(tankAngle) * (1.0);
        this.angle = tankAngle;
        this.playerIndex = 0;
      // now work out the velocity, which is velocity of tank plus
      // speed of shell in direction of the cannon
        var SHELL_SPEED = 400;
        this.speedX = tankSpeedX + Math.sin(tankAngle) * SHELL_SPEED; 
        this.speedY = tankSpeedY - Math.cos(tankAngle) * SHELL_SPEED; 
        this.color = tankColor;
        this.width = 2;
        this.height = 8;
        //console.log("Shell fired with position ", this.x, "' ", this.y, " at speed ", this.speedX, ", ", this.speedY, " angle ", this.angle);

        this.draw = function () {
            ctx.save();
            ctx.translate(this.x, this.y); 
            ctx.rotate(this.angle);
            ctx.fillStyle = this.color; 
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
            //this.color = 'black';
        };

        this.move = function () {
            // add horizontal increment to the x pos
            // add vertical increment to the y pos
            
            this.x += calcDistanceToMove(delta, this.speedX);
            this.y += calcDistanceToMove(delta, this.speedY);
/*
            var incX = this.v * Math.cos(this.angle);
            var incY = this.v * Math.sin(this.angle);

            this.x += calcDistanceToMove(delta, incX);
            this.y += calcDistanceToMove(delta, incY);
*/
        };
    }    

    function updateShells(delta) {
        // Move and draw each ball, testing collisions with balls, 
        for (var i = 0; i < shellArray.length; i++) {
            if (!shellArray[i]) continue; 
            var shell = shellArray[i];

            // 1) move the ball
            shell.move();
            
            testShellCollisionWithBalls(i);
            
            shell.draw();
        }
    }
    
    function testShellCollisionWithBalls(shellIndex) {
      // see if a shell has hit one or more of the balls
        shell = shellArray[shellIndex]; 
        for (var i = 0; i < ballArray.length; i++) {
          if (!ballArray[i]) continue;   // ball already destroyed
          if (ballArray[i].ballHitAt) continue;   // ball already hit
          var ball = ballArray[i];
          // first check if the ball is not in the near vicinity, ie outside ballRadius + 10 (say) of the point of the shell
          if (ball.x - shell.x > ball.radius + 10 || shell.x - ball.x > ball.radius + 10 || 
              ball.y - shell.y > ball.radius + 10 || shell.y - ball.y > ball.radius + 10) {
                continue;
          }
          // now do more detailed calculation
          // the shell, of width 2 and height 8 has been rotated clockwise through shell.angle 
          // hence need to rotate both shell and ball anticlockwise through the same angle to get shell sides parallel to the axes
          // using the (x,y) position of the shell as origin for the rotation
          // As per with the tank, we change the coordinates so that they have y in the usual upwards direction 
          ballY2 = canvasHeight - ball.y;
          shellY2 = canvasHeight - shell.y;
          ballRotatedX = shell.x + Math.cos(shell.angle) * (ball.x - shell.x) - Math.sin(shell.angle) * (ballY2 - shellY2);
          ballRotatedY2 = shellY2 + Math.sin(shell.angle) * (ball.x - shell.x) + Math.cos(shell.angle) * (ballY2 - shellY2);
          ballRotatedY = canvasHeight - ballRotatedY2;
          if (circRectsOverlap(shell.x, shell.y, 2, 8, ballRotatedX, ballRotatedY, ball.radius)) {
            // hit the ball!
              //console.log("Shell hit ball ", i);
              currentScore[shell.playerIndex] += 1;
              ball.ballHitAt = performance.now();
              ball.color = shell.color;
              playSound(audioSound[PLOPSOUND], 100);
              shellArray[shellIndex] = null; 
          }
        }
    }
       
      
    
    function testShellCollisionWithWalls() {
      // delete pointers to shells which stray outside the canvas 
        for (var i = 0; i < shellArray.length; i++) {
            if (!shellArray[i]) continue; 
            shell = shellArray[i];
            if (shell.x < -10 || shell.x > canvasWidth + 10 || shell.y < -10 || shell.y > canvasHeight + 10) {
                //console.log("removing shell ", i);
                shellArray[i] = null; 
            }
        }
    }

    function updateGamepadConfig(navgamepads) {
        var i, j;
      // sets up the html on the web page to enable the players to configure their gamepad buttons to use etc
      // this depends on how many buttons etc the connected gamepad supports 
      console.log("in updateGamepadConfig with ", navgamepads.length, " gamepads ", navgamepads);
      for (i=0; i < 2; i++) {
        var selector1 = '#gamepad' + (i+1) + 'User';
        var selector2 = 'select[id^=g' + (i+1) + ']';   // for selecting the <option>s tags for this gamepad
        if (navgamepads[i] === undefined || navgamepads[i] === null || !navgamepads[i].connected) {
          $(selector1).html('<option value="notConnected">Not connected</option>');
          $(selector2).html('<option value="notConnected">N/A</option>');
          $('#test'+(i+1)).html('');   // remove the test axes and buttons 
          gamepad[i].connected = false; 
          gamepad[i].configured = false; 
          gamepad[i].navgamepad = null; 
/*        } else if ((!navgamepads[i].connected)) {
          $(selector1).html('<option value="notConnected">Not connected</option>');
          $(selector2).html('<option value="notConnected">N/A</option>');
          gamepad[i].connected = false; 
          gamepad[i].configured = false;  */
        } else {
          if (gamepad[i].configured) continue;     // don't overwrite how this gamepad has been configured
          // set up the properties of this gamepad
          gamepad[i].id = navgamepads[i].id; 
          gamepad[i].configured = true;
          gamepad[i].connected = true;
          gamepad[i].navgamepad = navgamepads[i];
          var prevConfig = previousGamepadConfig(gamepad[i].id);
          if (prevConfig) {
              console.log ("found previous config for ", gamepad[i].id, prevConfig.h, prevConfig.v, prevConfig.fire, prevConfig.rleft, prevConfig.rright);
              gamepad[i].horizontal = prevConfig.h; 
              gamepad[i].vertical = prevConfig.v; 
              gamepad[i].fire = prevConfig.fire; 
              gamepad[i].rotateRight = prevConfig.rright; 
              gamepad[i].rotateLeft = prevConfig.rleft; 
          } else {
              gamepad[i].horizontal = DEFAULT_H_AXIS;
              gamepad[i].vertical = DEFAULT_Y_AXIS;
              gamepad[i].fire = DEFAULT_FIRE_BUTTON; 
              gamepad[i].rotateRight = DEFAULT_ROTATE_RIGHT_BUTTON;
              gamepad[i].rotateLeft = DEFAULT_ROTATE_LEFT_BUTTON;
          }
          // now set up the html fields 
          $(selector1).html('<option value="notConnected">Not connected</option>' + '<option value="player1">Player 1</option>' +
              '<option value="player2">Player 2</option>' + '<option value="notUsed" selected="selected">Not used</option>');
          // allow configuration of each of the 5 controls for the gamepad: left/right and up/down use Axes, fire and rotate right / left use Buttons 
          // the defaults for these are the values in the gamepad fields - whether these have been restored from previous config, or set to the standard defaults
          $('#g' + (i+1) + 'horizontal').html(gamepadAxisOptions(navgamepads[i].axes, gamepad[i].horizontal));
          $('#g' + (i+1) + 'vertical').html(gamepadAxisOptions(navgamepads[i].axes, gamepad[i].vertical));
          $('#g' + (i+1) + 'rotateLeft').html(gamepadButtonOptions(navgamepads[i].buttons, gamepad[i].rotateLeft));
          $('#g' + (i+1) + 'rotateRight').html(gamepadButtonOptions(navgamepads[i].buttons, gamepad[i].rotateRight));
          $('#g' + (i+1) + 'fire').html(gamepadButtonOptions(navgamepads[i].buttons, gamepad[i].fire));
          // set up the line of axes / buttons to allow the player to test his controls
          // axes and buttons are displayed starting from B1, B2, etc although we use 0, 1, 2 internally
          var htmlText = 'Test:&nbsp;&nbsp;Axes&nbsp;';
          for (j = 0; j < navgamepads[i].axes.length; j++) {   // assume axes start from 1 instead of 0 (like buttons)
            htmlText += '<input type="button" id="g' + (i+1) + 'A' + j + '" class="round-button" value="A' + (j+1) + '" />';
          }
          htmlText += '&nbsp;&nbsp;Buttons&nbsp;';
          for (j = 0; j < navgamepads[i].buttons.length; j++) {  // buttons start from 1 instead of 0
            htmlText += '<input type="button" id="g' + (i+1) + 'B' + j + '" class="round-button" value="B' + (j+1) + '" />';
          }
          $('#test'+(i+1)).html(htmlText);

        }
      }
    }

    function gamepadButtonOptions(buttons, defaultButton) {
      // prepares the html <option> tags for a gamepad button control
      var htmlText = '';
      var i;
      for (i=0; i < buttons.length; i++) {   // buttons go B1, B2, ... not from B0, although we use 0, 1, 2, .. internally
        htmlText += '<option value="B' + i + '"' + (i == defaultButton ? ' selected="selected"' : '') + '>Button ' + (i+1) + '</option>';
      }
      //console.log(htmlText);
      return htmlText; 
    }
    
    function gamepadAxisOptions(axes, defaultAxis) {   // axes go A1, A2, ... not from A0, although we use 0, 1, 2, .. internally
      // prepares the html <option> tags for a gamepad axis control
      var htmlText = '';
      var i;
      for (i=0; i < axes.length; i++) {
        htmlText += '<option value="A' + i + '"' + (i == defaultAxis ? 'selected="selected"' : '') + '>Axis ' + (i+1) + '</option>';
      }
      //console.log(htmlText);
      return htmlText; 
    }

    function highlightGamepadControls(navgamepads) {
      var i, j;
      // this highlights on the web page the buttons and axes that the player is pressing
      // it's done by setting the CSS class of the appropriate element(s) to "highlight", giving a background yellow colour
      if (!navgamepads) return;
      for (i = 0; i < navgamepads.length; i++) {
        if (!navgamepads[i] || !navgamepads[i].connected) continue;
        // remove any previous highlighting on axes and buttons, and set any highlights from buttons/axes currently pressed
        // remove from all children under the element with id = test1 or test2 (depending on gamepad)
        // then set it on individual button/axes options via the id which is g1b0, g1b1, .. g1a0, g1a1,.., g2b0, g2b1, .. g2a0, ...
        $('#test'+(i+1)+' input').removeClass('highlight'); 
        for (j = 0; j < navgamepads[i].axes.length; j++) {
          if (Math.abs(navgamepads[i].axes[j]) > 0.1) {
            //console.log("setting highlight on gamepad ", i+1, " for axis A", j);
            $('#g'+(i+1)+'A'+j).addClass('highlight');
          }
        }
        for (j = 0; j < navgamepads[i].buttons.length; j++) {
          if (navgamepads[i].buttons[j].pressed) {
            //console.log("setting highlight on gamepad ", i+1, " for button B", j);
            $('#g'+(i+1)+'B'+j).addClass('highlight');
          }
        }
      }
            
    }
    
   
    function loadAssets(callback) {
        // here we should load the souds, the sprite sheets etc.
        // then at the end call the callback function
        
        var count = 5;
        var onload = function() { 
            console.log ("asset loaded");
            if (--count === 0) callback();
        };

        loadSoundUsingAjax(PLOPSOUND_URL, PLOPSOUND, onload);
        loadSoundUsingAjax(EXPLOSIONSOUND_URL, EXPLOSIONSOUND, onload); 
        loadSoundUsingAjax(FIRESOUND_URL, FIRESOUND, onload);
        
        tankImage[0] = new Image();
        tankImage[0].src = TANK1_IMAGE_URL; 
        tankImage[0].onload = function() {
          tank[0].width = tankImage[0].width;
          tank[0].height = tankImage[0].height; 
          tank[0].diagonal = Math.sqrt(tank[0].width * tank[0].width + tank[0].height * tank[0].height);
          console.log("tank image loaded, size ", tank[0].width, " by ", tank[0].height);
          onload();
        };
        tankImage[1] = new Image();
        tankImage[1].src = TANK2_IMAGE_URL; 
        tankImage[1].onload = function() {
          tank[1].width = tankImage[1].width;
          tank[1].height = tankImage[1].height; 
          tank[1].diagonal = Math.sqrt(tank[1].width * tank[1].width + tank[1].height * tank[1].height);
          console.log("tank image loaded, size ", tank[1].width, " by ", tank[1].height);
          onload();
        };

        function loadSoundUsingAjax(url, index, callback) {
           var request = new XMLHttpRequest();
           request.open('GET', url, true);
           // Important: we're loading binary data
           request.responseType = 'arraybuffer';
         
           // Decode asynchronously
           request.onload = function() {
              console.log("Sound loaded");
              // Let's decode it. This is also asynchronous
              audio_ctx.decodeAudioData(request.response,
                  function(buffer) { // success
                     console.log("Sound decoded for index ", index);
                     audioSound[index] = buffer;      
                     callback();
                  },
                  function(e) { // error
                     console.log("sound load error");
                  }
              ); // end of decodeAudioData callback
            };   // end of the onload callback
            // Send the request. When the file will be loaded,
            // the request.onload callback will be called (above)
            request.send();
        }
    
    }
    
    function playSound(buffer, gainValue){
        // builds the audio graph, then start playing the source
        var bufferSource = audio_ctx.createBufferSource();
        bufferSource.buffer = buffer;
        if (gainValue) {
          //console.log("Playing sound with gain of ", gainValue); 
          var gainNode = audio_ctx.createGain();
          gainNode.gain.value = gainValue;
          bufferSource.connect(gainNode);
          gainNode.connect(audio_ctx.destination);
        } else {
          bufferSource.connect(audio_ctx.destination);
        }
        bufferSource.start(); 
    }
    
    
    var start = function () {
        // adds a div for displaying the fps value
        fpsContainer = document.createElement('div');
        document.body.appendChild(fpsContainer);

        // Canvas, context etc.
        canvas = document.querySelector("#myCanvas");

        // often useful
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;

        // important, we will draw with this object
        ctx = canvas.getContext('2d');
        // default police for text
        ctx.font = "20px Arial";

        //add the listener to the main, window object, and update the states
        window.addEventListener('keydown', function (event) {
          // use keys a(left) w(up) right(d) s(down) instead of 37, 38, 39, 40
            if (event.keyCode === 37) {
                inputStates.left = true;
            } else if (event.keyCode === 38) {
                inputStates.up = true;
            } else if (event.keyCode === 39) {
                inputStates.right = true;
            } else if (event.keyCode === 40) {
                inputStates.down = true;
            } else if (event.keyCode === 32) {
              //console.log("got space pressed");
                inputStates.space = true;
            }
        }, false);

        //if the key will be released, change the states object 
        window.addEventListener('keyup', function (event) {
          // use keys a(left) w(up) right(d) s(down) instead of 37, 38, 39, 40
            if (event.keyCode === 37) { 
                inputStates.left = false;
            } else if (event.keyCode === 38) {
                inputStates.up = false;
            } else if (event.keyCode === 39) {
                inputStates.right = false;
            } else if (event.keyCode === 40) {
                inputStates.down = false;
            } else if (event.keyCode === 32) {
                inputStates.space = false;
            }
        }, false);

        // Mouse event listeners
        canvas.addEventListener('mousemove', function (evt) {
            inputStates.mousePos = getMousePos(evt);
        }, false);

        canvas.addEventListener('mousedown', function (evt) {
            inputStates.mousedown = true;
            inputStates.mouseButton = evt.button;
        }, false);

        canvas.addEventListener('mouseup', function (evt) {
            inputStates.mousedown = false;
        }, false);

        document.getElementById('startGame1').addEventListener('click', function() { 
            console.log("New 1 player game!");
            currentGameState = gameStates.gameOver;
            numPlayers = 1;
            inputStates.newGame = true; 
        });

        document.getElementById('startGame2').addEventListener('click', function() { 
            console.log("New 2 player game!");
            currentGameState = gameStates.gameOver;
            numPlayers = 2;
            inputStates.newGame = true; 
        });
        
        // gamepad support
        window.addEventListener("gamepadconnected", function(e) {
          redisplayGamepads = true;
          var gamepad = e.gamepad;
          var index = gamepad.index;
          var id = gamepad.id;
          var nbButtons = gamepad.buttons.length;
          var nbAxes = gamepad.axes.length;
          console.log("Gamepad No " + index +
                     ", with id " + id + " is connected. It has " +
                     nbButtons + " buttons and " +
                     nbAxes + " axes");
        });
        window.addEventListener("gamepaddisconnected", function(e) {
          redisplayGamepads = true;
          var gamepad = e.gamepad;
          var index = gamepad.index;
          console.log("Gamepad No " + index + " has been disconnected");
        });
        
        document.getElementById('mouseUser').addEventListener('change', function(event) {
          var e = document.getElementById('mouseUser');
          console.log("mouseUser event, value ", e.options[e.selectedIndex].value);
          if (e.options[e.selectedIndex].value == 'player1') {
            player1UsingMouse = true; 
          } else {
            player1UsingMouse = false; 
          }
          // if player1 has been chosen to use this gamepad, then set mouse/keyboard to not used as the default 
          // the users can override this, but that's their own look out.
          $("#Player1mouse").attr("selected", "selected");
        });
        
        document.getElementById('gamepad1User').addEventListener('change', function(event) {
          var e = document.getElementById('gamepad1User');
          console.log("gamepad1User event, value ", e.options[e.selectedIndex].value);
          if (e.options[e.selectedIndex].value == 'player1') {
            gamepad[0].playerIndex = 0;
            // if player1 has been chosen to use this gamepad, then set mouse/keyboard to not used as the default 
            // the users can override this, but that's their own look out.
            $("#Player1mouse").attr("selected", "selected");
            player1UsingMouse = false; 
          } else if (e.options[e.selectedIndex].value == 'player2') {
            gamepad[0].playerIndex = 1;
          } else {
            gamepad[0].playerIndex = null;
          }
        });
        
        document.getElementById('gamepad2User').addEventListener('change', function(event) {
          var e = document.getElementById('gamepad2User');
          console.log("gamepad2User event, value ", e.options[e.selectedIndex].value);
          if (e.options[e.selectedIndex].value == 'player1') {
            gamepad[1].playerIndex = 0;
            // if player1 has been chosen to use this gamepad, then set mouse/keyboard to not used as the default 
            // the users can override this, but that's their own look out.
            $("#Player1mouse").attr("selected", "selected");
            player1UsingMouse = false; 
          } else if (e.options[e.selectedIndex].value == 'player2') {
            gamepad[1].playerIndex = 1;
          } else {
            gamepad[1].playerIndex = null;
          }
        });
        
        document.getElementById('g1horizontal').addEventListener('change', function(event) {
          var e = document.getElementById('g1horizontal');
          var axis = e.options[e.selectedIndex].value;
          gamepad[0].horizontal = parseInt(axis[1]);
          saveGamepadConfig(gamepad[0].id, gamepad[0].horizontal, gamepad[0].vertical, gamepad[0].fire, gamepad[0].rotateLeft, gamepad[0].rotateRight);
          //console.log("g1horizontal event, value ", gamepad[0].horizontal);
        });  
        
        document.getElementById('g1vertical').addEventListener('change', function(event) {
          var e = document.getElementById('g1vertical');
          var axis = e.options[e.selectedIndex].value;
          gamepad[0].vertical = parseInt(axis[1]);
          saveGamepadConfig(gamepad[0].id, gamepad[0].horizontal, gamepad[0].vertical, gamepad[0].fire, gamepad[0].rotateLeft, gamepad[0].rotateRight);
        });  
        
        document.getElementById('g1fire').addEventListener('change', function(event) {
          var e = document.getElementById('g1fire');
          var button = e.options[e.selectedIndex].value;
          gamepad[0].fire = parseInt(button[1]);
          saveGamepadConfig(gamepad[0].id, gamepad[0].horizontal, gamepad[0].vertical, gamepad[0].fire, gamepad[0].rotateLeft, gamepad[0].rotateRight);
        }); 
        
        document.getElementById('g1rotateLeft').addEventListener('change', function(event) {
          var e = document.getElementById('g1rotateLeft');
          var button = e.options[e.selectedIndex].value;
          gamepad[0].rotateLeft = parseInt(button[1]);
          saveGamepadConfig(gamepad[0].id, gamepad[0].horizontal, gamepad[0].vertical, gamepad[0].fire, gamepad[0].rotateLeft, gamepad[0].rotateRight);
        });  
        
        document.getElementById('g1rotateRight').addEventListener('change', function(event) {
          var e = document.getElementById('g1rotateRight');
          var button = e.options[e.selectedIndex].value;
          gamepad[0].rotateRight = parseInt(button[1]);
          saveGamepadConfig(gamepad[0].id, gamepad[0].horizontal, gamepad[0].vertical, gamepad[0].fire, gamepad[0].rotateLeft, gamepad[0].rotateRight);
        });  
        
        document.getElementById('g2horizontal').addEventListener('change', function(event) {
          var e = document.getElementById('g2horizontal');
          var axis = e.options[e.selectedIndex].value;
          gamepad[1].horizontal = parseInt(axis[1]);
          saveGamepadConfig(gamepad[1].id, gamepad[1].horizontal, gamepad[1].vertical, gamepad[1].fire, gamepad[1].rotateLeft, gamepad[1].rotateRight);
        });  
        
        document.getElementById('g2vertical').addEventListener('change', function(event) {
          var e = document.getElementById('g2vertical');
          var axis = e.options[e.selectedIndex].value;
          gamepad[1].vertical = parseInt(axis[1]);
          saveGamepadConfig(gamepad[1].id, gamepad[1].horizontal, gamepad[1].vertical, gamepad[1].fire, gamepad[1].rotateLeft, gamepad[1].rotateRight);
        });  
        
        document.getElementById('g2fire').addEventListener('change', function(event) {
          var e = document.getElementById('g2fire');
          var button = e.options[e.selectedIndex].value;
          gamepad[1].fire = parseInt(button[1]);
          saveGamepadConfig(gamepad[1].id, gamepad[1].horizontal, gamepad[1].vertical, gamepad[1].fire, gamepad[1].rotateLeft, gamepad[1].rotateRight);
        }); 
        
        document.getElementById('g2rotateLeft').addEventListener('change', function(event) {
          var e = document.getElementById('g2rotateLeft');
          var button = e.options[e.selectedIndex].value;
          gamepad[1].rotateLeft = parseInt(button[1]);
          saveGamepadConfig(gamepad[1].id, gamepad[1].horizontal, gamepad[1].vertical, gamepad[1].fire, gamepad[1].rotateLeft, gamepad[1].rotateRight);
        });  
        
        document.getElementById('g2rotateRight').addEventListener('change', function(event) {
          var e = document.getElementById('g2rotateRight');
          var button = e.options[e.selectedIndex].value;
          gamepad[1].rotateRight = parseInt(button[1]);
          saveGamepadConfig(gamepad[1].id, gamepad[1].horizontal, gamepad[1].vertical, gamepad[1].fire, gamepad[1].rotateLeft, gamepad[1].rotateRight);
        });  
        

        // configuration parameters
        numInitialBalls = parseInt(document.getElementById('nballs').value);
        console.log("number of initial balls set to ", numInitialBalls);
        document.getElementById('nballs').addEventListener('change', function() { 
            numInitialBalls = parseInt(document.getElementById('nballs').value);
            console.log("number of initial balls changed to ", numInitialBalls);
        });
        
        initialAveSpeedBalls = parseInt(document.getElementById('sballs').value);
        aveSpeedBalls = initialAveSpeedBalls;
        console.log("average speed of initial balls set to ", aveSpeedBalls);
        document.getElementById('sballs').addEventListener('change', function() { 
            aveSpeedBalls = parseInt(document.getElementById('sballs').value);
            console.log("average speed of initial balls changed to ", aveSpeedBalls);
        });
        
        tankSpeed = parseInt(document.getElementById('tspeed').value);
        tankSpeed45deg = 0.707 * tankSpeed;
        console.log("tank speed set to ", tankSpeed);
        document.getElementById('tspeed').addEventListener('change', function() { 
            tankSpeed = parseInt(document.getElementById('tspeed').value);
            tankSpeed45deg = 0.707 * tankSpeed;
            console.log("tank speed changed to ", tankSpeed);
        });        

        turretRotationSpeed = parseInt(document.getElementById('turretRotationSpeed').value);
        console.log("Turret rotation speed set to ", turretRotationSpeed);
        document.getElementById('turretRotationSpeed').addEventListener('change', function() { 
            turretRotationSpeed = parseInt(document.getElementById('turretRotationSpeed').value);
            console.log("Turret rotation speed changed to ", turretRotationSpeed);
        });
        
        loadAssets(function () {
            // all assets (images, sounds) loaded, we can start the animation
            requestAnimationFrame(mainLoop);
        });
    };

    //our GameFramework returns a public API visible from outside its scope
    return {
        start: start
    };
};

// ----------------------------------------------------------------------------------
// ------------- indexDB routines
// ----------------------------------------------------------------------------------

function openDataStore() {
  
    if (!window.indexedDB) {
        window.alert("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
    }
      
    var dbName = "GamepadConfig";
     
    var request = indexedDB.open(dbName, 1);
     
    request.onerror = function(event) {
      // Handle errors.
      console.log("request.onerror errcode=" + event.target.error.name);
    };
    
    request.onupgradeneeded = function(event) {
      console.log("request.onupgradeneeded, we are creating a new version of the dataBase");
      db = event.target.result;
     
      var objectStore = db.createObjectStore("gamepads", { keyPath: "id" });

    };
      
    request.onsuccess = function(event) {
      console.log("request.onsuccess, database opened ok");
      db = event.target.result;  
      retrieveRecords();
    };
}

function retrieveRecords() {   // retrieve configurations of gamepads saved from previous sessions
    if(db === null) {
      alert('Database not available');
      return;
    }
    
    console.log("in retrieveRecords");
    var nRecs = 0;
    gamepad_config_records = [];
    var objectStore = db.transaction("gamepads", "readonly").objectStore("gamepads");

    objectStore.openCursor().onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
            console.log("found a gamepad record, key: ", cursor.key, " value: ", cursor.value);
            gamepad_config_records[nRecs++] = { id: cursor.key, h: cursor.value.h, v: cursor.value.v , fire: cursor.value.fire, 
                    rleft: cursor.value.rleft, rright: cursor.value.rright };
            cursor.continue();
        } else {
            console.log(gamepad_config_records.length, " gamepad records found");
        }
    };
}

function previousGamepadConfig(id) {
    for (var i = 0; i < gamepad_config_records.length; i++) {
        if (id == gamepad_config_records[i].id) {
            return gamepad_config_records[i];
        }
    }
    return null;
}

function saveGamepadConfig(id, h, v, fire, rleft, rright) {
    console.log("In saveGamepadConfig for ", id, h, v, fire, rleft, rright);
    //  need to check if this gamepad id already has a record - if so, we'll update it, otherwise we'll create a new one
    for (var i = 0; i < gamepad_config_records.length; i++) {
        if (id == gamepad_config_records[i].id) {
            gamepad_config_records[i].h = h; 
            gamepad_config_records[i].v = v; 
            gamepad_config_records[i].fire = fire; 
            gamepad_config_records[i].rleft = rleft; 
            gamepad_config_records[i].rright = rright; 
            updateRecord(gamepad_config_records[i]);
            return;
        }
    }
    // record not found, so we need to add a new one.
    var recnum = gamepad_config_records.length;
    gamepad_config_records[recnum] = { id: id, h: h, v: v, fire: fire, rleft: rleft, rright: rright };  
    addNewRecord(gamepad_config_records[recnum]);
}

function updateRecord(recordToUpdate) {
    
    if(db === null) return;
    
    console.log("in updateRecord with ", recordToUpdate);
    
    var transaction = db.transaction(["gamepads"], "readwrite");
    
    transaction.oncomplete = function(event) {
        console.log("Record updated ok!");
    };
 
    transaction.onerror = function(event) {
        console.log("transaction.onerror errcode=" + event.target.error.name);
    };
 
    var objectStore = transaction.objectStore("gamepads");
    
    var request = objectStore.put(recordToUpdate);
    
    request.onsuccess = function(event) {
        console.log("Record updated");
    };
    request.onerror = function(event) {
        console.log("request.onerror, could not update record, errcode = " + event.target.error.name);
    };
}

function addNewRecord(recordToAdd) {
    if(db === null) return;
    
    console.log("in addNewRecord with record: ", recordToAdd);
    
    var objectStore = db.transaction("gamepads", "readwrite").objectStore("gamepads");
    
    objectStore.onsuccess = function(event) {
        console.log("New record saved to database");
    };
    objectStore.onerror = function(event) {
        console.log("Add new record error: ", event.error);
    };
    objectStore.add(recordToAdd);
}