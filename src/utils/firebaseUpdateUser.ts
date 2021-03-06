import firebase from "firebase";

const usersRef = firebase.firestore().collection("users");

const firebaseUpdateUser = (payload: any, uid: string) => {
  return new Promise((resolve, reject) => {
    usersRef
      .doc(uid)
      .update(payload)
      .then((res) => resolve(res))
      .catch((error: any) => reject(error));
  });
};

export default firebaseUpdateUser;
