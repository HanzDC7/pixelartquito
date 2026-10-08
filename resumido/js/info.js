'use strict';

// Fichas de los lugares: [nombre, dato corto, texto]. Las usan las dos vistas.
(() => {
    Q.INFO = {
        cotopaxi: ['Volcán Cotopaxi', '5.897 m · unos 50 km al sur', 'Uno de los volcanes activos más altos del mundo. En los días despejados su cono nevado se ve desde el sur de Quito.'],
        pichincha: ['Volcán Pichincha', 'Guagua 4.784 m · Rucu 4.698 m', 'La ciudad se recuesta en sus faldas. En 1999 el Guagua Pichincha cubrió Quito de ceniza, y en estas laderas se libró la Batalla de Pichincha el 24 de mayo de 1822.'],
        teleferico: ['TelefériQo', 'De unos 3.100 a casi 4.000 m', 'Uno de los teleféricos más altos del mundo. Sube por la ladera del Pichincha hasta Cruz Loma, donde empieza el sendero al Rucu. Funciona desde 2005.'],
        panecillo: ['El Panecillo y la Virgen de Quito', 'Loma de 3.016 m', 'La loma que separa el centro del sur. La Virgen alada, armada con unas 7.000 piezas de aluminio, se inauguró en 1976 y se inspira en la escultura de Bernardo de Legarda, de 1734.'],
        itchimbia: ['Itchimbía', 'Parque y mirador', 'Desde aquí se domina todo el centro histórico. Su centro cultural ocupa la estructura de hierro y vidrio del antiguo mercado de Santa Clara.'],
        sanfrancisco: ['Iglesia y convento de San Francisco', 'Desde el siglo XVI', 'El conjunto religioso más grande del centro histórico. Empezó a levantarse pocos años después de la fundación española, en 1534. Cuenta la leyenda que Cantuña terminó el atrio con ayuda del diablo… y que le faltó una piedra.'],
        compania: ['Iglesia de la Compañía de Jesús', '1605 – 1765', 'Joya del barroco quiteño: fachada tallada en piedra volcánica e interior recubierto de pan de oro.'],
        catedral: ['Catedral Metropolitana', 'Costado sur de la Plaza Grande', 'Aquí descansan los restos del mariscal Antonio José de Sucre, vencedor de la Batalla de Pichincha.'],
        plaza: ['Plaza de la Independencia', 'La Plaza Grande', 'El corazón del centro histórico. El monumento recuerda el Primer Grito de Independencia del 10 de agosto de 1809. Quito fue, con Cracovia, la primera ciudad declarada Patrimonio Cultural de la Humanidad por la UNESCO, en 1978.'],
        carondelet: ['Palacio de Carondelet', 'Sede del Gobierno', 'La casa presidencial del Ecuador. En su entrada hacen guardia los Granaderos de Tarqui, con su uniforme del siglo XIX.'],
        basilica: ['Basílica del Voto Nacional', 'Torres de 115 m', 'El templo neogótico más grande de América. En vez de gárgolas clásicas tiene animales del Ecuador: iguanas, tortugas, armadillos y cóndores. Se empezó en 1892 y, según la tradición, nunca debe darse por terminada.'],
        metro: ['Metro de Quito', '15 estaciones · 22 km', 'El primer metro del Ecuador. Opera desde diciembre de 2023 y cruza la ciudad bajo tierra, de Quitumbe a El Labrador, en unos 34 minutos.'],
        moderna: ['La Carolina y el Quito moderno', 'Centro financiero', 'Alrededor del parque La Carolina crecen las torres más altas de la ciudad. El parque tiene laguna con botes, jardín botánico y kilómetros de ciclovía.'],
        estadio: ['Estadio Olímpico Atahualpa', 'Inaugurado en 1951', 'Casa histórica de la selección ecuatoriana de fútbol. Jugar aquí, a casi 2.800 metros de altura, siempre fue un reto para los visitantes.'],
        mitad: ['Ciudad Mitad del Mundo', 'Latitud 0° · unos 26 km al norte', 'El monumento de 30 metros marca la línea ecuatorial que midió la misión geodésica francesa en el siglo XVIII. Con GPS, la línea real pasa unos 240 metros más al norte.'],
        trole: ['Trolebús', 'Desde 1995', 'El sistema de buses eléctricos que recorre la ciudad de sur a norte por un carril exclusivo.'],
        bicentenario: ['Parque Bicentenario', 'El antiguo aeropuerto', 'La pista del viejo aeropuerto Mariscal Sucre, que operó hasta febrero de 2013, hoy es un parque para caminar, patinar y pedalear. A su lado está El Labrador, la estación del extremo norte del Metro.'],
    };
})();
