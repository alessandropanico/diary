// src/app/services/progetti.service.ts

import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, getDoc, or } from 'firebase/firestore';
import { Observable, from, switchMap, map } from 'rxjs';
import { UserDataService } from 'src/app/services/user-data.service';
import { Timestamp } from 'firebase/firestore';
import { Firestore } from '@angular/fire/firestore';

export interface Project {
  id?: string;
  name: string;
  description: string;
  status: 'In corso' | 'Completato' | 'In pausa' | 'Archiviato';
  progress: number;
  dueDate?: Date;
  createdAt: Date;
  lastUpdated: Date;
  uid: string;
  members: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ProgettiService {
  private db = getFirestore();

  constructor(
    private userDataService: UserDataService,
    private firestore: Firestore
  ) {}

  /**
   * Ottiene i progetti di cui l'utente corrente è proprietario.
   */
  getProjects(): Observable<Project[]> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([[]]);
        }
        const projectsCollection = collection(this.firestore, 'projects');
        const q = query(projectsCollection, where('uid', '==', uid));
        return from(getDocs(q)).pipe(
          map(snapshot => {
            const projects: Project[] = [];
            snapshot.forEach(doc => {
              const data = doc.data() as any;
              projects.push({
                id: doc.id,
                ...data,
                dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
                lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : data.lastUpdated
              });
            });
            return projects;
          })
        );
      })
    );
  }

  /**
   * Ottiene tutti i progetti di cui l'utente corrente è proprietario o membro.
   */
  getProjectsForUser(): Observable<Project[]> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([[]]);
        }
        const projectsCollection = collection(this.firestore, 'projects');
        const q = query(projectsCollection, or(where('uid', '==', uid), where('members', 'array-contains', uid)));
        return from(getDocs(q)).pipe(
          map(snapshot => {
            const projects: Project[] = [];
            snapshot.forEach(doc => {
              const data = doc.data() as any;
              projects.push({
                id: doc.id,
                ...data,
                dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
                lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : data.lastUpdated
              });
            });
            return projects;
          })
        );
      })
    );
  }

  getProjectById(id: string): Observable<Project | undefined> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([undefined]);
        }
        const projectDocRef = doc(this.firestore, 'projects', id);
        return from(getDoc(projectDocRef)).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data() as any;
              if (data['uid'] === uid || (data['members'] && data['members'].includes(uid))) {
                return {
                  id: docSnapshot.id,
                  ...data,
                  dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
                  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
                  lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : data.lastUpdated
                };
              }
            }
            return undefined;
          })
        );
      })
    );
  }

  async addProject(project: Partial<Project>, userIdToAdd?: string): Promise<string> {
    const userId = userIdToAdd || this.userDataService.getCurrentUserId();
    if (!userId) {
      throw new Error('User not logged in or no userId provided');
    }
    const newProject: Project = {
      ...project,
      uid: userId,
      description: project.description || '',
      status: project.status || 'In corso',
      progress: project.progress || 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
      members: project.members || []
    } as Project;
    const docRef = await addDoc(collection(this.firestore, 'projects'), newProject);
    return docRef.id;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<void> {
    const projectDocRef = doc(this.firestore, 'projects', id);
    return updateDoc(projectDocRef, {
      ...data,
      lastUpdated: new Date()
    });
  }

  async deleteProject(id: string): Promise<void> {
    const projectDocRef = doc(this.firestore, 'projects', id);
    return deleteDoc(projectDocRef);
  }

  getProjectsByUid(userId: string): Observable<Project[]> {
    if (!userId) {
      return from([[]]);
    }
    const projectsCollection = collection(this.firestore, 'projects');
    const q = query(projectsCollection, where('uid', '==', userId));
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const projects: Project[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as any;
          projects.push({
            id: doc.id,
            ...data,
            dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
            lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : data.lastUpdated
          });
        });
        return projects;
      })
    );
  }
}
