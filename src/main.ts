import "./styles.css";
import { App } from "./ui/app.ts";

const root = document.getElementById("app");
if (root) void new App(root).start();
