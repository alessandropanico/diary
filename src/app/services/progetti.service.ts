import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Observable, from, switchMap, map } from 'rxjs';
import { UserDataService } from './user-data.service'; // ⭐ Importazione corretta ⭐

export interface Project {
  id?: string;
  name: string;
  status: 'In corso' | 'Completato' | 'In pausa';
  dueDate?: Date;
  progress: number;
  uid: string; // ID dell'utente proprietario del progetto
  description: string;
  tasks: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ProgettiService {
  private db = getFirestore();

  constructor(
    private userDataService: UserDataService // ⭐ Iniezione del tuo servizio ⭐
  ) {}

  /**
   * Ottiene tutti i progetti dell'utente loggato.
   * @returns Observable di un array di progetti.
   */
  getProjects(): Observable<Project[]> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([[]]); // Ritorna un Observable di un array vuoto se l'utente non è loggato
        }
        const projectsCollection = collection(this.db, 'projects');
        const q = query(projectsCollection, where('uid', '==', uid));
        return from(getDocs(q)).pipe(
          map(snapshot => {
            const projects: Project[] = [];
            snapshot.forEach(doc => {
              const data = doc.data() as Project;
              projects.push({ id: doc.id, ...data });
            });
            return projects;
          })
        );
      })
    );
  }

  /**
   * Ottiene un singolo progetto tramite ID.
   * @param id L'ID del progetto.
   * @returns Observable del progetto o undefined.
   */
  getProjectById(id: string): Observable<Project | undefined> {
    return this.userDataService.userStatus$.pipe(
      switchMap(uid => {
        if (!uid) {
          return from([undefined]);
        }
        const projectDocRef = doc(this.db, 'projects', id);
        return from(getDoc(projectDocRef)).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists() && docSnapshot.data()?.['uid'] === uid) {
              const data = docSnapshot.data() as Project;
              return { id: docSnapshot.id, ...data };
            }
            return undefined;
          })
        );
      })
    );
  }

  /**
   * Aggiunge un nuovo progetto.
   * @param project Il progetto da aggiungere (senza ID).
   * @returns Una Promise con l'ID del documento.
   */
  async addProject(project: Partial<Project>): Promise<string> {
    const userId = this.userDataService.getCurrentUserId();
    if (!userId) {
      throw new Error('User not logged in');
    }
    const newProject: Project = {
      ...project,
      uid: userId,
      status: project.status || 'In corso',
      progress: project.progress || 0,
      description: project.description || '',
      tasks: project.tasks || []
    } as Project;
    const docRef = await addDoc(collection(this.db, 'projects'), newProject);
    return docRef.id;
  }

  /**
   * Aggiorna un progetto esistente.
   * @param id L'ID del progetto da aggiornare.
   * @param data I dati da aggiornare.
   * @returns Una Promise.
   */
  async updateProject(id: string, data: Partial<Project>): Promise<void> {
    const projectDocRef = doc(this.db, 'projects', id);
    return updateDoc(projectDocRef, data);
  }

  /**
   * Elimina un progetto.
   * @param id L'ID del progetto da eliminare.
   * @returns Una Promise.
   */
  async deleteProject(id: string): Promise<void> {
    const projectDocRef = doc(this.db, 'projects', id);
    return deleteDoc(projectDocRef);
  }
}
