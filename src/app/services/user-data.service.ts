import { Injectable } from '@angular/core';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private db = getFirestore();

  private getUserUid(): string | null {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
  }

  async getUserData(): Promise<any> {
    const uid = this.getUserUid();
    if (!uid) return null;

    const docRef = doc(this.db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async saveUserData(data: any) {
    const uid = this.getUserUid();
    if (!uid) return;

    const docRef = doc(this.db, 'users', uid);
    await setDoc(docRef, data, { merge: true });
  }

}
