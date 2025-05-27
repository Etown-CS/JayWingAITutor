<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            text-align: center;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            margin-bottom: 20px;
            color: #004B98;
        }
        .input-field {
            display: flex;
            flex-direction: column;
            margin: 10px 0;
        }
        .input-field label {
            margin-bottom: 5px;
            font-weight: bold;
        }
        .input-field input {
            padding: 8px;
            font-size: 16px;
            border-radius: 5px;
            border: 1px solid #ccc;
            outline: none;
        }
        button {
            padding: 10px 20px;
            margin: 10px;
            font-size: 18px;
            cursor: pointer;
            background-color: #004B98;
            color: white;
            border: none;
            border-radius: 5px;
        }
        button:hover {
            background-color: #0A2240;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to the AI Tutor System</h1>
        <div class="input-field">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="Enter your username">
        </div>
        <div class="input-field">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password">
        </div>
        <button onclick="handleLogin()">Login</button>
        <button onclick="handleSignup()">Sign Up</button>
    </div>

    <script>
        async function handleLogin() {
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            try {
                const response = await fetch("../backend/login.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ username, password, role: "student" }) // or dynamic role
                });

                if (!response.ok) throw new Error("HTTP error " + response.status);
                const data = await response.json();
                if (data.success) {
                    window.location.href = data.route;
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("Login failed: " + err.message);
            }
        }

        async function handleSignup() {
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            const response = await fetch("../backend/signup.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    username,
                    password,
                    role: "student" // default to student
                })
            });

            const data = await response.json();
            if (data.success) {
                window.location.href = data.route;
            } else {
                alert(data.message);
            }
        }
    </script>
</body>
</html>
