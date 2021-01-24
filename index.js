import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { graphqlHTTP } from "express-graphql";
import morgan from "morgan";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();
import { format } from "date-fns";
import cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
const app = express();
/*
  *****************************************
           cloudinary  config
  *****************************************
 */
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let cloudinaryVersion = cloudinary.v2;
/*
  *****************************************
             multer config
  *****************************************
 */
const fileStorage = new CloudinaryStorage({
  cloudinary: cloudinaryVersion,
  folder: "uploads",
  filename: (req, file, cb) => {
    const date = format(new Date(), "dd-MM-yy");
    const fileType = file.mimetype == "video/mp4" ? "VIDEO" : "IMAGE";
    const fileNameFormat = `${date}-${fileType}-${file.originalname}`;
    cb(null, fileNameFormat);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|gif|png|mp4)$/i)) {
    cb(null, false);
  } else {
    cb(null, true);
  }
};
const multerMiddleware = multer({
  storage: fileStorage,
  fileFilter,
});

const initServer = async () => {
  // Add CORS
  app.use(cors());
  // Parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: true }));

  // Parse application/json
  app.use(bodyParser.json());

  // Parse application/vnd.api+json as json
  app.use(bodyParser.json({ type: "application/vnd.api+json" }));

  app.use(morgan("dev"));

  app.get("/", (req, res) => {
    res.send("Welcome !");
  });
  app.post(
    "/single-upload",
    multerMiddleware.single("file"),
    async (req, res) => {
      try {
        console.log(req.file);
        if (!req.file) {
          return res.status(200).json({ message: "Invalid file type" });
        }
        let file = {};
        await cloudinary.v2.uploader.upload(req.file.path, (error, result) => {
          console.log(result);
          file.cloudinaryPublicId = result.public_id;
          file.fileName = result.original_filename;
          file.imageUrl = result.secure_url;
        });

        return res.status(200).json({ message: "File stored", file });
      } catch (error) {
        console.log(error);
        return res
          .status(500)
          .json({ message: "Something went wrong while uplaoding this item" });
      }
    }
  );
  app.post(
    "/multiple-upload",
    multerMiddleware.array("files"),
    async (req, res) => {
      try {
        if (!req.files) {
          return res.status(200).json({ message: "Invalid file type" });
        }
        let uploadedFiles = await imageUploaderHandler({ files: req.files });
        return res.status(200).json({ message: "File stored", uploadedFiles });
      } catch (error) {
        console.log(error);
        return res
          .status(500)
          .json({ message: "Something went wrong while uplaoding this item" });
      }
    }
  );

  const imageUploaderHandler = async ({ files }) => {
    let newImages = files.map(async (item) => {
      return await cloudinary.v2.uploader.upload(item.path, (error, result) => {
        if (result.public_id) {
          return {
            cloudinaryPublicId: result.public_id,
            fileUrl: result.secure_url,
            fileName: result.original_filename,
          };
        }
      });
    });

    let returnedOb = await Promise.all(newImages);
    return returnedOb;
  };

  try {
    // Start the server
    app.listen(3000, (error) => {
      if (!error) {
        console.log(`⚡ Server is running at http://localhost:3000`);
      } else {
        console.warn("❌ ERR: App crashed", error);
      }
    });
  } catch (error) {
    console.warn("❌ ERR: Mongoose connection failed", error.message);
  }
};

initServer();
