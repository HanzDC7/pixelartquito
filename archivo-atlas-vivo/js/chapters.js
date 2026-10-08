'use strict';

// Los relatos distinguen la leyenda y la ficción de los datos patrimoniales.
Q.CHAPTERS = [
    {
        id: 'cantuna', title: 'La piedra que faltaba', tag: 'LEYENDA QUITEÑA', color: '#D99B68', place: 'sanfrancisco', time: '4 viñetas · 2 min',
        description: 'Un atrio, una promesa imposible y una piedra que cambia el final.',
        source: ['Quito Informa · La leyenda de Cantuña', 'https://quitoinforma.quito.gob.ec/2026/09/29/paredes-que-cuentan-historias-leyendas-quitenas-son-plasmadas-en-los-pasos-deprimidos-de-las-av-tarqui-y-10-de-agosto/'],
        frames: [
            { place: 'sanfrancisco', hour: 16.5, title: 'Una promesa al caer el sol', text: 'La plaza se vacía. Según la leyenda, Cantuña debe terminar el atrio de San Francisco antes de que llegue la mañana. La tarea parece imposible.', voice: 'Relato adaptado de la tradición oral' },
            { place: 'sanfrancisco', hour: 22, title: 'El trato de medianoche', text: 'El diablo ofrece acabar la obra a cambio de su alma. Hay una condición: no puede faltar una sola piedra. En la oscuridad, el atrio empieza a tomar forma.', voice: 'Leyenda · no es un hecho documentado' },
            { place: 'sanfrancisco', hour: 5.7, title: 'Un pequeño vacío', text: 'En una de las versiones del relato, una piedra queda fuera de la obra. Ese detalle rompe el pacto: un atrio casi terminado no es un atrio terminado.', voice: 'Las versiones de la leyenda varían' },
            { place: 'sanfrancisco', hour: 6.8, title: 'Quito despierta', text: 'Amanece y Cantuña conserva su alma. La ciudad guarda el relato entre sus piedras. Ahora te toca observar: encuentra las parejas del atrio en el juego de memoria.', voice: 'La leyenda continúa en el arcade', game: 'memory' },
        ],
    },
    {
        id: 'memoria', title: 'La ciudad que recuerda', tag: 'PATRIMONIO · 1978', color: '#95B6AE', place: 'plaza', time: '4 viñetas · 2 min',
        description: 'Un paseo entre plazas, oficios y fachadas que siguen contando historias.',
        source: ['UNESCO · Ciudad de Quito', 'https://whc.unesco.org/en/list/2/'],
        frames: [
            { place: 'plaza', hour: 8, title: 'El primer paso', text: 'Imagina que llevas un cuaderno vacío. En la Plaza Grande anotas el sonido del agua, una conversación y la sombra de las palmeras. La memoria de una ciudad también está en lo cotidiano.', voice: 'Paseo imaginado por el centro' },
            { place: 'compania', hour: 10, title: 'Leer la piedra', text: 'La Compañía invita a mirar despacio: columnas, relieves y ritmos que hacen de la fachada una página tallada. El centro de Quito conserva una extraordinaria mezcla de arte y arquitectura.', voice: 'Observa antes de seguir' },
            { place: 'sanfrancisco', hour: 15.5, title: 'Un patrimonio compartido', text: 'En 1978, la Ciudad de Quito fue inscrita en la Lista del Patrimonio Mundial de la UNESCO. Sus iglesias y conventos forman parte de ese conjunto, junto con el paisaje urbano que los conecta.', voice: 'Dato documentado · UNESCO, 1978' },
            { place: 'basilica', hour: 18.15, title: 'La página siguiente', text: 'La luz baja y las ventanas se encienden. Tu cuaderno ya tiene una ruta. Guarda una postal de este momento y busca los cinco sellos de tu pasaporte para seguir la expedición.', voice: 'Tu propia historia empieza aquí' },
        ],
    },
    {
        id: 'altura', title: 'Del jardín a las nubes', tag: 'UN DÍA EN QUITO', color: '#B8C77D', place: 'moderna', time: '4 viñetas · 2 min',
        description: 'Sigue a un colibrí desde los parques hasta las laderas del Pichincha.',
        frames: [
            { place: 'moderna', hour: 9, title: 'Un destello en el jardín', text: 'En este pequeño cuento, un colibrí sale a buscar flores. Entre las torres de La Carolina descubre una pausa verde y una laguna que refleja el cielo.', voice: 'Ficción ambientada en Quito' },
            { place: 'basilica', hour: 12, title: 'Por encima de los tejados', text: 'El colibrí sigue una corriente tibia sobre las tejas. Abajo, los buses dibujan líneas de colores. Arriba, las torres parecen conversar con las montañas.', voice: 'La ciudad desde otra escala' },
            { place: 'teleferico', hour: 16, title: 'La montaña respira', text: 'Las cabinas suben y bajan. El verde se vuelve páramo y la ciudad se extiende al fondo. Nuestro viajero se detiene: incluso las alas más rápidas necesitan una pausa.', voice: 'Una pausa sobre las laderas' },
            { place: 'pichincha', hour: 18, title: 'Volver antes de la lluvia', text: 'Las primeras nubes anuncian el regreso. Ayuda al colibrí a recoger ocho flores y esquivar las gotas. El jardín lo espera antes de que termine el día.', voice: 'Continúa el cuento jugando', game: 'bird' },
        ],
    },
];

Q.EXPEDITION = [
    { id: 'panecillo', name: 'El Panecillo', stamp: '01', clue: 'Una figura alada vigila la ciudad desde una loma.', title: 'Guardián del sur' },
    { id: 'sanfrancisco', name: 'San Francisco', stamp: '02', clue: 'Un atrio de piedra guarda la leyenda de un pacto imposible.', title: 'Memoria de piedra' },
    { id: 'plaza', name: 'Plaza Grande', stamp: '03', clue: 'Palmeras, una fuente y el corazón del centro histórico.', title: 'El corazón de Quito' },
    { id: 'basilica', name: 'La Basílica', stamp: '04', clue: 'Dos torres, vitrales y siluetas que apuntan hacia el cielo.', title: 'Mirar hacia arriba' },
    { id: 'moderna', name: 'La Carolina', stamp: '05', clue: 'Un jardín y una laguna entre las torres de la ciudad moderna.', title: 'Un respiro verde' },
];
