import * as functions from "firebase-functions";
import { tmpdir } from "os";
import * as sharp from "sharp";
import * as fs from "fs-extra";
import { dirname, join } from "path";
import * as storage from "@google-cloud/storage";
import slugify from "slugify";
import * as yup from "yup";
import { ValidationError } from "yup";
import { createDeflate } from "zlib";

const admin = require("firebase-admin");
admin.initializeApp();

// for front-end username validation
const usersRef = admin.firestore().collection("users");
const usersPrivateRef = admin.firestore().collection("usersPrivate");

export const usernameIsTaken = functions.https.onCall((data: any) => {
  const username = data.username;
  return usersRef
    .where("username", "==", username)
    .get()
    .then((querySnapshot: any) => {
      if (querySnapshot.docs.length > 0) {
        return true;
      } else {
        return false;
      }
    });
});

const schema = yup.object({
  username: yup
    .string()
    .required()
    .min(3)
    .max(15)
    .matches(
      /^[a-zA-Z0-9]+([_ -]?[a-zA-Z0-9])*$/,
      "Can not contain spaces or special characters"
    ),
});
const formatYupError = (err: ValidationError) => {
  const errors: Array<{ path: string; message: string }> = [];
  err.inner.forEach((e) => {
    errors.push({
      path: e.path,
      message: e.message,
    });
  });

  return errors;
};
// unique username checker
export const createUsername = functions.https.onCall(
  async (data: any, context) => {
    const username = data.username;

    try {
      await schema.validate({ username: data.username }, { abortEarly: false });
    } catch (err) {
      return formatYupError(err);
    }

    if (context.auth) {
      const uid = context.auth.uid;
      console.log(`Request create username '${username}' for user ${uid}`);

      const usernameSlug = slugify(username, {
        remove: /[$*+~.,()'"!\-:@]/g,
        lower: true,
      });
      //
      const userHasUsername = async (uid: string): Promise<boolean> => {
        console.log(`Checking if user ${uid} already has a username`);
        return await usersRef
          .doc(uid)
          .get()
          .then((doc: any) => {
            const username = doc.data().username;
            if (username) {
              console.log("Has username, ", username);
              return true;
            } else {
              console.log("User does not have username, proceed...");
              return false;
            }
          });
      };

      // convert to util 'dataExists'
      const requestedUsernameIsUnique = async (
        username: string
      ): Promise<boolean> => {
        console.log(
          `Checking if requested username (${username}) is available`
        );
        return await usersRef
          .where("username", "==", username)
          .get()
          .then((querySnapshot: any) => {
            if (querySnapshot.docs.length > 0) {
              console.log(`Found existing username for ${username}`);
              return false;
            } else {
              console.log(`No existing username for ${username}`);
              return true;
            }
          })
          .catch((err: any) => console.log(err));
      };

      const setUsername = async (
        username: string,
        uid: string
      ): Promise<void> => {
        console.log(`Setting username ${username} for user ${uid}`);
        return await usersRef.doc(uid).update({
          username,
          createdUsername: true,
          slug: usernameSlug,
        });
      };

      if (
        (await userHasUsername(uid)) === false &&
        (await requestedUsernameIsUnique(username)) === true
      ) {
        console.log(`create username '${username}' for user ${uid}`);
        await setUsername(username, uid);
        return true;
      } else {
        console.log("Could not create username");
        return false;
      }

      // if no auth for some obscure reason, thanks Typescript
    } else {
      console.log("Something else didn't work");
      return false;
    }
  }
);

// createNewUserDoc - create user document server side
export const createNewUserDoc = functions.auth.user().onCreate(async (user) => {
  console.log(`Creating document for user ${user.uid}`);
  await usersRef.doc(user.uid).set({
    createdat: admin.firestore.fieldvalue.servertimestamp(),
    createdusername: false,
    emailverified: false,
    likes: 0,
  });
  await usersPrivateRef.doc(user.uid).set({
    createdat: admin.firestore.fieldvalue.servertimestamp(),
    notificationSettings: {
      notificationWhenWall: true,
      notificationWhenLike: false,
      //
      notificationTypeDrawer: true,
      notificationTypeEmail: true,
      notificationTypePush: false,
    },
  });
});

// Thumbnail generator
const sizes = [64, 128, 256];
const gcs = new storage.Storage();
export const generateThumbs = functions.storage
  .object()
  .onFinalize(async (object) => {
    const bucket = gcs.bucket(object.bucket);
    const filePath = object.name;
    if (filePath) {
      const fileName = filePath?.split("/").pop();
      const bucketDir = dirname(filePath);

      const workingDir = join(tmpdir(), "thumbs");
      const tmpFilePath = join(workingDir, "source.png");

      if (
        fileName?.includes("thumb@") ||
        !object.contentType?.includes("image")
      ) {
        console.log("exiting function");
        return false;
      }

      // 1. Ensure thumbnail dir exists
      await fs.ensureDir(workingDir);

      // 2. Download Source File
      await bucket.file(filePath).download({
        destination: tmpFilePath,
      });

      // 3. Resize the images and define an array of upload promises

      const uploadPromises = sizes.map(async (size) => {
        const thumbName = `thumb@${size}_${fileName}`;
        const thumbPath = join(workingDir, thumbName);

        // Resize source image
        await sharp(tmpFilePath).resize(size, size).toFile(thumbPath);

        // Upload to GCS
        return bucket.upload(thumbPath, {
          destination: join(bucketDir, thumbName),
        });
      });

      // 4. Run the upload operations
      await Promise.all(uploadPromises);

      // 5. If this upload is an avatar, attach the thumbnails to the users' document
      if (bucketDir.includes("avatar")) {
        const userUid = bucketDir.split("/")[1];

        const [buckets] = await gcs.getBuckets();
        // Just get the first / only bucket of the project. This can probably be improved
        const [files] = await gcs.bucket(buckets[0].name).getFiles({
          prefix: bucketDir,
        });

        let thumbsObj = {} as any;

        files.forEach((file) => {
          file
            .getSignedUrl({
              action: "read",
              expires: "03-09-2491",
            })
            .then((signedUrl) => {
              // console.log("signedUrl: ", signedUrl[0]);
              // For each of our sizes, loop through
              sizes.forEach((size) => {
                if (signedUrl[0].includes(`thumb%40${size}`)) {
                  thumbsObj[size] = signedUrl[0];
                }
              });
            })
            .then(() => {
              // setUser thumbs
              usersRef
                .doc(userUid)
                .update({
                  avatarThumbs: thumbsObj,
                })
                .then((res: any) => {
                  console.log(res);
                })
                .catch((error: any) => {
                  console.log(error);
                });
            });
        });
      }

      // 6. Cleanup remove the tmp/thumbs from the filesystem
      return fs.remove(workingDir);
    }
  });

exports.deleteUser = functions.firestore

  .document("usersPrivate/{userID}")
  .onDelete((snap, context) => {
    // Get an object representing the document prior to deletion
    // e.g. {'name': 'Marie', 'age': 66}
    console.log("deleteUser context", context);
    const deletedValue = snap.data();
    console.log("deletedValue ", deletedValue);

    console.log(deletedValue);
    // data on deleted users we want to keep
    admin
      .firestore()
      .collection("usersPrivate")
      .doc(context.params.userID)
      .set({
        // deletedOn,
        // email,
        createdAt: deletedValue.createdat || null,
        deletedAt: admin.firestore.fieldvalue.servertimestamp(),
        // username
      });
    // perform desired operations ...
  });
