// index.mjs
import express from 'express';
import myroutes from './routes/routes.js'
import cors from "cors"
import morgan from "morgan"
import bodyParser from "body-parser";
import "dotenv/config.js";

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.json());

app.use('/api', myroutes);
app.get('/', (req, res) => { res.json("Backend Index"); });
const port = 3000; // Or whatever port you're using
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${port}`);
  console.log(`Access it externally via http://YOUR_SERVER_IP_ADDRESS:${port}`);
});
