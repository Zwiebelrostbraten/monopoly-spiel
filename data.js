export const colors=['#925d43','#67b9ce','#bb649b','#e79a48','#d45b56','#d8bd48','#57967c','#526ca8'];
const rows=[
[1,'Badstraße',0,60,[2,10,30,90,160,250]], [3,'Turmstraße',0,60,[4,20,60,180,320,450]],
[6,'Chausseestraße',1,100,[6,30,90,270,400,550]],[8,'Elisenstraße',1,100,[6,30,90,270,400,550]],[9,'Poststraße',1,120,[8,40,100,300,450,600]],
[11,'Seestraße',2,140,[10,50,150,450,625,750]],[13,'Hafenstraße',2,140,[10,50,150,450,625,750]],[14,'Neue Straße',2,160,[12,60,180,500,700,900]],
[16,'Münchner Straße',3,180,[14,70,200,550,750,950]],[18,'Wiener Straße',3,180,[14,70,200,550,750,950]],[19,'Berliner Straße',3,200,[16,80,220,600,800,1000]],
[21,'Theaterstraße',4,220,[18,90,250,700,875,1050]],[23,'Museumstraße',4,220,[18,90,250,700,875,1050]],[24,'Opernplatz',4,240,[20,100,300,750,925,1100]],
[26,'Lessingstraße',5,260,[22,110,330,800,975,1150]],[27,'Schillerstraße',5,260,[22,110,330,800,975,1150]],[29,'Goethestraße',5,280,[24,120,360,850,1025,1200]],
[31,'Rathausplatz',6,300,[26,130,390,900,1100,1275]],[32,'Hauptstraße',6,300,[26,130,390,900,1100,1275]],[34,'Bahnhofstraße',6,320,[28,150,450,1000,1200,1400]],
[37,'Parkstraße',7,350,[35,175,500,1100,1300,1500]],[39,'Schlossallee',7,400,[50,200,600,1400,1700,2000]]];
export const board=Array.from({length:40},(_,id)=>({id}));
for(const [id,name,group,price,rents] of rows)Object.assign(board[id],{name,group,price,rents,type:'street',build:50*(1+Math.floor(group/2)),color:colors[group]});
for(const [id,name,type,price] of [[0,'LOS','go'],[2,'Gemeinschaft','community'],[4,'Einkommensteuer','tax',200],[5,'Südbahnhof','rail',200],[7,'Ereignis','chance'],[10,'Gefängnis · Besuch','jail'],[12,'Elektrizitätswerk','utility',150],[15,'Westbahnhof','rail',200],[17,'Gemeinschaft','community'],[20,'Frei parken','parking'],[22,'Ereignis','chance'],[25,'Nordbahnhof','rail',200],[28,'Wasserwerk','utility',150],[30,'Ins Gefängnis','gojail'],[33,'Gemeinschaft','community'],[35,'Hauptbahnhof','rail',200],[36,'Ereignis','chance'],[38,'Zusatzsteuer','tax',100]])Object.assign(board[id],{name,type,price});
// Original short descriptions; effects follow the German classic card sets.
export const decks={
chance:[
{ text:'Auf nach LOS. Die Bank zahlt 200.',move:0 },
{ text:'Ein Termin in der Schlossallee. Reise dorthin.',move:39 },
{ text:'Besuche die Seestraße. LOS zählt auf dem Weg.',move:11 },
{ text:'Premiere am Opernplatz. Reise dorthin; LOS zählt.',move:24 },
{ text:'Zum nächsten Bahnhof. Dort gilt die doppelte Bahnhofsmiete.',nearest:'rail' },
{ text:'Zum nächsten Bahnhof. Dort gilt die doppelte Bahnhofsmiete.',nearest:'rail' },
{ text:'Zum nächsten Werk. Bei fremdem Besitz: neuer Wurf, zehnfache Augensumme.',nearest:'utility' },
{ text:'Die Bank schreibt dir 50 gut.',money:50 },
{ text:'Diese Karte befreit dich einmal aus dem Gefängnis.',free:true },
{ text:'Drei Felder zurück. Das Zielfeld zählt.',back:3 },
{ text:'Direkt ins Gefängnis. Kein LOS-Gehalt.',jail:true },
{ text:'Instandhaltung: je Haus 25, je Hotel 100 an die Bank.',repair:[25,100] },
{ text:'Eine Gebühr wird fällig: 15 an die Bank.',money:-15 },
{ text:'Reise zum Südbahnhof. LOS zählt auf dem Weg.',move:5 },
{ text:'Du lädst die Runde ein: zahle jeder anderen Person 50.',each:-50 },
{ text:'Deine Anlage zahlt sich aus: 150 von der Bank.',money:150 }
],
community:[
{text:'Auf nach LOS. Die Bank zahlt 200.',move:0},
{text:'Eine Bankkorrektur bringt dir 200.',money:200},
{text:'Die Arztkosten betragen 50.',money:-50},
{text:'Ein Verkauf bringt dir 50.',money:50},
{text:'Diese Karte befreit dich einmal aus dem Gefängnis.',free:true},
{text:'Direkt ins Gefängnis. Kein LOS-Gehalt.',jail:true},
{text:'Ein Sparvertrag wird fällig: du erhältst 100.',money:100},
{text:'Eine Rückzahlung bringt dir 20.',money:20},
{text:'Geburtstag! Jede andere Person zahlt dir 10.',each:10},
{text:'Eine Versicherung zahlt dir 100.',money:100},
{text:'Krankenhauskosten: zahle 100.',money:-100},
{text:'Ausbildungskosten: zahle 50.',money:-50},
{text:'Eine Beratung bringt dir 25.',money:25},
{text:'Straßenarbeiten: je Haus 40, je Hotel 115 an die Bank.',repair:[40,115]},
{text:'Ein kleiner Wettbewerb bringt dir 10.',money:10},
{text:'Eine Erbschaft bringt dir 100.',money:100}
]};
