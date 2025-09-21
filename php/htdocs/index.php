<?php
$servername = "mysql";
$username = "root";
$password = "root";
$dbname = "WEB_APP";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}
echo "✅ Connected successfully to MySQL from PHP!";
?>
