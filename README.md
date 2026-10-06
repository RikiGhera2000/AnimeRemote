# Anime Remote

Telecomando web per controllare dal telefono il video aperto in una scheda di Chrome sul PC. Il progetto non richiede pacchetti Python aggiuntivi.

## Requisiti

- Windows con Python installato (`py` oppure `python` nel terminale).
- Google Chrome sul PC.
- PC e iPhone collegati alla stessa rete locale. Il PC può essere collegato via Ethernet e l’iPhone via Wi-Fi, purché il router consenta loro di comunicare.

## 1. Avviare il server sul PC

Apri PowerShell nella cartella del progetto (`AnimeRemote`) ed esegui:

```powershell
py server.py
```

Se `py` non è disponibile, prova:

```powershell
python server.py
```

Lascia aperta la finestra del server. All’avvio mostra due indirizzi:

- **PC**: usa `http://127.0.0.1:8765` sullo stesso computer.
- **iPhone**: usa l’indirizzo di rete mostrato dal server, per esempio `http://192.168.1.25:8765`.

Se Windows chiede di consentire Python sulla rete, consenti l’accesso alla rete privata. Non usare `127.0.0.1` sull’iPhone: quell’indirizzo indica l’iPhone stesso, non il PC.

## 2. Caricare l’estensione in Chrome

1. Apri `chrome://extensions`.
2. Attiva **Modalità sviluppatore**.
3. Seleziona **Carica estensione non pacchettizzata**.
4. Scegli la cartella `remote` dentro `AnimeRemote`.
5. Se Chrome mostra una richiesta relativa al permesso **debugger**, approvala per usare il fullscreen remoto.

Dopo ogni modifica ai file dell’estensione, premi **Ricarica** nella pagina delle estensioni e aggiorna anche la pagina del video. Gli script dell’estensione vengono caricati quando la pagina si apre.

## 3. Collegare la scheda del video

1. In Chrome, apri la pagina del video.
2. Fai clic sull’icona di **Anime Remote Bridge**.
3. Premi **Collega questa scheda**.
4. Verifica nel popup che il titolo della scheda sia indicato come collegato.

Il telecomando controlla una sola scheda collegata alla volta. Per cambiare sito o scheda, apri il popup su quella scheda e collegala. Le altre schede non ricevono i comandi.

## 4. Aprire il telecomando sull’iPhone

1. Collega l’iPhone alla stessa rete locale del PC.
2. Apri Safari e inserisci l’indirizzo **iPhone** mostrato dal server, seguito da `:8765`, per esempio `http://192.168.1.25:8765`.
3. Usa i pulsanti sullo schermo. La finestra Python deve restare aperta mentre usi il telecomando.

La connessione Ethernet del PC va bene. Se il telefono non raggiunge il server, verifica che non sia collegato alla rete Wi-Fi ospiti e che il firewall di Windows consenta Python sulla rete privata.

## Come funziona

- `server.py` serve la pagina del telecomando sulla porta `8765` e mette in coda i comandi ricevuti dal telefono.
- La pagina web invia i tocchi al server tramite Wi-Fi.
- L’estensione Chrome interroga il server dal PC e usa l’ID della scheda collegata per instradare i comandi.
- Gli script dell’estensione cercano il frame che contiene il video visibile, così Play/Pausa, ricerca e volume non vengono applicati a più player contemporaneamente.
- **Fullscreen** invia il tasto `F` tramite l’API debugger di Chrome. Per questo Chrome può mostrare un avviso che Anime Remote Bridge ha avviato il debug del browser; è previsto quando si usa questo comando.
- Precedente/Successivo cercano nella pagina principale pulsanti o link con etichette come “precedente”, “successivo”, “previous” o “next”. Il risultato dipende dal sito.

## Comandi disponibili

- Play/Pausa
- Indietro o avanti di 10 secondi
- Episodio precedente o successivo
- Volume su/giù e muto
- Schermo intero

I player dei siti possono comportarsi in modo diverso. Un comando “inviato” sul telefono conferma che il server lo ha ricevuto, ma non garantisce che il player del sito lo abbia eseguito.

## Risoluzione dei problemi

- **La pagina sul telefono non si apre**: controlla l’indirizzo IP mostrato dal server, la rete Wi-Fi e il firewall di Windows.
- **Il telecomando dice “comando inviato” ma la pagina non reagisce**: verifica che la scheda corretta sia collegata, aggiorna la pagina del video e controlla che il server sia ancora in esecuzione.
- **Hai appena aggiornato l’estensione**: ricaricala da `chrome://extensions`, aggiorna la pagina del video e collega di nuovo la scheda.
- **Fullscreen non parte**: il player deve essere raggiungibile e riconoscere il tasto `F`; l’avviso debugger di Chrome è previsto.
- **Arrestare il server**: torna alla finestra Python e premi `CTRL+C`.
