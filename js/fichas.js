'use strict';

/*
 * Las fichas de los lugares del mapa real y el pasaporte de visitas.
 *
 * Cada ficha: n nombre · s dato corto · z zona · d datos en pares · h la
 * historia, por párrafos · c una curiosidad.
 *
 * Son textos de divulgación. Las fechas y medidas son las que se repiten en
 * las fuentes habituales; conviene verificarlas antes de usarlas en un
 * material oficial.
 */
(() => {
    Q.ZONAS = ['Centro Histórico', 'Centro norte', 'Norte', 'Sur', 'Cerros y miradores', 'Mitad del Mundo'];

    Q.INFO = {
        // ───────────────────────── Centro Histórico ─────────────────────────
        plaza: {
            n: 'Plaza de la Independencia', s: 'La Plaza Grande', z: 0,
            d: [['Trazada', '1534'], ['Monumento', '1906'], ['Altitud', '2.818 m']],
            h: [
                'Es la plaza mayor que los españoles trazaron al fundar la ciudad, en diciembre de 1534, sobre lo que había sido un centro inca. Desde entonces los cuatro poderes la rodean: al occidente el gobierno (Carondelet), al sur la Iglesia (la Catedral), al norte el Palacio Arzobispal y al oriente el Municipio.',
                'Durante siglos fue mercado, plaza de toros y sitio de pregones. La pila del centro abastecía de agua al vecindario hasta que, en 1906, la reemplazó el Monumento a la Independencia, que recuerda el Primer Grito del 10 de agosto de 1809: arriba, la Libertad con su antorcha; abajo, un cóndor que rompe las cadenas y un león herido —España— que se retira.',
                'Por aquel 10 de agosto, Quito lleva el título de «Luz de América». Y en 1978 su centro histórico, el más grande y mejor conservado de América Latina, fue declarado —junto con Cracovia— el primer Patrimonio Cultural de la Humanidad de la UNESCO.',
            ],
            c: 'Los jubilados que conversan en sus bancas son parte del paisaje: la plaza sigue siendo la sala de estar de la ciudad.',
        },
        carondelet: {
            n: 'Palacio de Carondelet', s: 'Sede del Gobierno del Ecuador', z: 0,
            d: [['Remodelado', 'hacia 1801'], ['Fachada', 'unos 100 m'], ['Guardia', 'Granaderos de Tarqui']],
            h: [
                'Aquí funcionó la Real Audiencia de Quito desde el siglo XVII. Su aspecto actual se debe al barón Héctor de Carondelet, presidente de la Audiencia entre 1799 y 1807, que encargó la larga columnata que mira a la plaza. Se cuenta que fue Simón Bolívar quien, admirado, lo empezó a llamar «el palacio de Carondelet».',
                'Los balcones de hierro del segundo piso vienen de París: pertenecieron al Palacio de las Tullerías, incendiado en 1871. En los bajos, las «covachas» siguen siendo pequeñas tiendas y peluquerías, como en la Colonia.',
                'En sus gradas fue asesinado el presidente Gabriel García Moreno, el 6 de agosto de 1875. Dentro, un gran mural de Oswaldo Guayasamín recuerda el descubrimiento del río Amazonas, que partió de Quito en 1541.',
            ],
            c: 'Los Granaderos de Tarqui que hacen guardia visten el uniforme con que su unidad peleó en 1829.',
        },
        catedral: {
            n: 'Catedral Metropolitana', s: 'Catedral Primada del Ecuador', z: 0,
            d: [['Construcción', '1562 – 1567'], ['Lado', 'sur de la plaza'], ['Estilos', 'mudéjar, barroco, neoclásico']],
            h: [
                'Una de las catedrales más antiguas de Sudamérica. A diferencia de casi todas, no da la cara a la plaza sino el costado: el terreno, cortado por una quebrada, obligó a levantarla a lo largo. Por eso se entra por un lado, por la escalinata semicircular del Arco de Carondelet.',
                'Adentro descansan el mariscal Antonio José de Sucre, vencedor de la Batalla de Pichincha, y varios presidentes de la República. El artesonado de cedro es de tradición mudéjar y sus pinturas, de la Escuela Quiteña.',
                'También guarda una historia negra: el Viernes Santo de 1877 el obispo José Ignacio Checa y Barba murió envenenado con estricnina puesta en el vino del cáliz.',
            ],
            c: 'En lo alto hay un gallo de veleta. Dice la leyenda que don Ramón Ayala, un bravucón que lo insultaba cada noche al volver de las chicherías, recibió una madrugada su picotazo… y nunca más bebió.',
        },
        compania: {
            n: 'Iglesia de la Compañía de Jesús', s: 'La joya del barroco quiteño', z: 0,
            d: [['Construcción', '1605 – 1765'], ['Fachada', 'piedra andesita'], ['Interior', 'pan de oro']],
            h: [
                'Los jesuitas tardaron 160 años en terminarla. La planta sigue la de la iglesia del Gesù, en Roma, y la fachada —tallada entera en piedra volcánica gris, entre 1722 y 1765— tiene columnas salomónicas inspiradas en el baldaquino de Bernini en San Pedro.',
                'Adentro casi no queda un centímetro sin cubrir: retablos, bóveda y muros están revestidos de pan de oro sobre cedro tallado, con lacerías de gusto mudéjar. Es, para muchos, el templo barroco más logrado de América.',
                'La orden la disfrutó poco: dos años después de concluir la fachada, en 1767, los jesuitas fueron expulsados de los dominios españoles. Bajo el altar mayor reposan los restos de santa Mariana de Jesús, la «Azucena de Quito». Un incendio en 1996 obligó a una restauración que duró casi una década.',
            ],
            c: 'A la entrada, dos lienzos enormes —el Infierno y el Juicio Final— muestran con todo detalle el castigo que toca a cada pecado.',
        },
        sanfrancisco: {
            n: 'Iglesia y convento de San Francisco', s: 'El conjunto más grande del centro', z: 0, campana: true,
            d: [['Inicio', 'hacia 1535'], ['Extensión', 'unas 3,5 hectáreas'], ['Claustros', '13']],
            h: [
                'Empezó a levantarse apenas un mes después de la fundación de la ciudad, sobre el solar donde la tradición ubica el palacio del inca Huayna Cápac. Lo impulsó el franciscano flamenco fray Jodoco Ricke, a quien se atribuye además haber sembrado el primer trigo de Quito.',
                'Con tres iglesias, trece claustros y una plaza en pendiente, es el mayor conjunto arquitectónico de los centros históricos de América. Aquí funcionó el Colegio San Andrés, donde indígenas y mestizos aprendieron a pintar y esculpir: el semillero de la Escuela Quiteña. En el altar mayor está la Virgen alada de Bernardo de Legarda (1734), el modelo de la que hoy corona El Panecillo.',
                'Las torres eran más altas: el terremoto de 1868 las derribó y se rehicieron más bajas. Bajo la plaza funciona desde 2023 una estación del Metro; al excavarla aparecieron vestigios prehispánicos y coloniales.',
            ],
            c: 'El indígena Cantuña, cuenta la leyenda, se comprometió a construir el atrio y, al ver que no llegaba, vendió su alma al diablo. Los diablillos trabajaron toda la noche, pero al amanecer faltaba una piedra: Cantuña salvó el alma. Dicen que el hueco todavía está.',
        },
        santodomingo: {
            n: 'Iglesia y plaza de Santo Domingo', s: 'Donde Sucre señala el Pichincha', z: 0, campana: true,
            d: [['Construcción', '1581 – 1650'], ['Orden', 'dominicos'], ['Monumento', '1892']],
            h: [
                'Los dominicos levantaron su convento en el extremo sur de la ciudad colonial. La iglesia conserva un artesonado mudéjar y, a un costado, la Capilla del Rosario: para construirla tuvieron que tender un arco por encima de la calle Rocafuerte, que todavía se cruza por debajo.',
                'En el centro de la plaza está la estatua del mariscal Antonio José de Sucre. Su brazo extendido apunta a las faldas del Pichincha, al sitio exacto donde el 24 de mayo de 1822 ganó la batalla que selló la independencia.',
                'Por aquí pasa el Trolebús y, a pocos pasos, empieza la calle de La Ronda.',
            ],
        },
        merced: {
            n: 'Basílica de La Merced', s: 'La torre más alta del Quito colonial', z: 0, campana: true,
            d: [['Construcción', '1701 – 1747'], ['Torre', '47 m'], ['Cúpulas', '5']],
            h: [
                'Blanca por fuera y recargada por dentro, de estuco rosado y blanco. Los mercedarios la terminaron en 1747 sobre un templo anterior, y le dieron la torre más alta de la ciudad colonial: 47 metros, con un reloj traído de Londres a inicios del siglo XIX.',
                'Su Virgen de la Merced es la patrona de la ciudad contra terremotos y erupciones: a ella se encomendó Quito cada vez que el Pichincha amenazó. El convento guarda una de las bibliotecas antiguas más ricas del país.',
            ],
            c: 'Otra leyenda quiteña: la torre de La Merced nunca fue bendecida, y dicen que el diablo vive en ella.',
        },
        sanagustin: {
            n: 'Convento de San Agustín', s: 'La sala donde se firmó la Independencia', z: 0, campana: true,
            d: [['Construcción', '1580 – 1669'], ['Acta', '16 de agosto de 1809']],
            h: [
                'En su Sala Capitular, bajo un artesonado dorado, los patriotas ratificaron el 16 de agosto de 1809 el acta del Primer Grito de Independencia. Un año después, el 2 de agosto de 1810, casi todos fueron asesinados en el cuartel real; sus restos descansan en la cripta de esta misma sala.',
                'El claustro exhibe la gran serie de lienzos sobre la vida de san Agustín que Miguel de Santiago, el mayor pintor de la Escuela Quiteña, terminó en 1656.',
            ],
        },
        ronda: {
            n: 'Calle de La Ronda', s: 'Juan de Dios Morales', z: 0,
            d: [['Origen', 'un sendero prehispánico'], ['Largo', 'unos 320 m'], ['Rehabilitada', '2006']],
            h: [
                'Antes de ser calle fue un «chaquiñán», un sendero que bajaba al agua bordeando la quebrada de Ullaguangayacu, que hoy corre entubada. Los españoles la llamaron La Ronda por las rondas de vigilancia nocturna.',
                'A inicios del siglo XX fue el barrio de los bohemios: poetas, músicos y pintores vivían en sus casas de patio y balcón. Aquí nacieron varios pasillos que todavía se cantan.',
                'Hoy sus casas rehabilitadas alojan talleres de oficios que casi habían desaparecido —hojalateros, sombrereros, fabricantes de trompos— junto a cafés donde se sirve canelazo y empanadas de viento.',
            ],
        },
        museociudad: {
            n: 'Museo de la Ciudad y Arco de la Reina', s: 'El antiguo Hospital San Juan de Dios', z: 0,
            d: [['Hospital', '1565 – 1974'], ['Museo', '1998'], ['Arco', 'siglo XVIII']],
            h: [
                'Durante más de cuatro siglos funcionó aquí el Hospital de la Misericordia de Nuestro Señor Jesucristo, luego San Juan de Dios: el más antiguo de la ciudad. Por sus salas pasó, como médico, Eugenio Espejo, el precursor de la Independencia.',
                'El Arco de la Reina, que cruza la calle García Moreno, se construyó para dar techo a los fieles que rezaban ante la capilla del hospital. Enfrente está el monasterio del Carmen Alto, levantado sobre la casa donde vivió y murió santa Mariana de Jesús.',
            ],
        },
        teatrosucre: {
            n: 'Teatro Nacional Sucre', s: 'Plaza del Teatro', z: 0,
            d: [['Inauguración', '1886'], ['Estilo', 'neoclásico'], ['Restauración', '2003']],
            h: [
                'La plaza fue antes la de las Carnicerías: matadero, mercado y, los domingos, coso para corridas de toros. En 1886 se inauguró aquí el teatro de ópera de la ciudad, con su frontón y sus seis columnas, obra del arquitecto alemán Francisco Schmidt.',
                'Tras décadas de abandono fue restaurado y reabrió en 2003. Es la casa de la Orquesta y de la temporada lírica de Quito.',
            ],
        },
        basilica: {
            n: 'Basílica del Voto Nacional', s: 'El templo neogótico más grande de América', z: 0, campana: true,
            d: [['Primera piedra', '10 de julio de 1892'], ['Torres', '115 m'], ['Largo', '140 m'], ['Ancho', '35 m']],
            h: [
                'Nació de una promesa: en 1873 el Ecuador se consagró al Sagrado Corazón de Jesús, y diez años después el padre Julio María Matovelle propuso un templo que lo recordara. El arquitecto francés Emilio Tarlier lo dibujó inspirándose en la catedral de Bourges; la primera piedra se puso en 1892.',
                'La obra avanzó a lo largo de todo un siglo, pagada en buena parte con donaciones de piedras labradas a nombre de familias. El papa Juan Pablo II la bendijo en 1985 y se inauguró en 1988, aunque oficialmente sigue inconclusa.',
                'En vez de gárgolas con monstruos medievales tiene fauna del Ecuador: iguanas, tortugas de Galápagos, armadillos, monos, pumas y cóndores. Se puede subir a las torres del reloj y cruzar por un tablado sobre la bóveda hasta la torre de los cóndores.',
            ],
            c: 'Dice la tradición que el día en que la Basílica se termine, se acabará el mundo. Por si acaso, nadie parece tener apuro.',
        },
        itchimbia: {
            n: 'Itchimbía y Palacio de Cristal', s: 'El balcón del Centro Histórico', z: 4,
            d: [['Altitud', '2.910 m'], ['Parque', '54 hectáreas'], ['Estructura', '1889, de Hamburgo']],
            h: [
                'Una loma al oriente del centro desde donde se domina toda la ciudad vieja, con el Panecillo a la izquierda, la Basílica al frente y el Pichincha de telón.',
                'El Palacio de Cristal es una estructura de hierro y vidrio traída de Hamburgo a fines del siglo XIX. Durante cien años fue el Mercado de Santa Clara, el primero techado de Quito; en 2004 se desmontó pieza por pieza y se volvió a armar aquí como centro cultural.',
            ],
        },
        panecillo: {
            n: 'El Panecillo y la Virgen de Quito', s: 'Shungoloma, la loma del corazón', z: 4,
            d: [['Cumbre', '3.016 m'], ['Sobre el centro', 'unos 200 m'], ['Monumento', '41 m con su base'], ['Inauguración', '1975']],
            h: [
                'Para los pueblos anteriores a la Conquista fue Yavirac o Shungoloma, y la tradición ubica en su cima un templo dedicado al sol. Los españoles, más prosaicos, le vieron forma de pan pequeño.',
                'La Virgen alada es obra del escultor español Agustín de la Herrán Matorras, que amplió la talla de 30 centímetros hecha por Bernardo de Legarda en 1734. Está armada con unas 7.000 piezas de aluminio y se la tiene por la mayor escultura de ese metal en el mundo. Pisa una serpiente encadenada sobre el globo terráqueo.',
                'El cerro marca la frontera entre el centro y el sur. Como la Virgen mira hacia el norte, en el sur se dice, medio en broma, que les da la espalda.',
            ],
            c: 'A media ladera queda la Olla del Panecillo, una cisterna de ladrillo que por mucho tiempo se creyó inca y que en realidad es colonial.',
        },

        // ───────────────────────── Centro norte ─────────────────────────
        alameda: {
            n: 'Parque La Alameda', s: 'El parque más antiguo de Quito', z: 1,
            d: [['Creado', '1596'], ['Observatorio', '1873'], ['Forma', 'triángulo']],
            h: [
                'Los indígenas llamaban a este llano Chuquihuada, «punta de lanza», por su forma. El Cabildo lo destinó a paseo público en 1596, de modo que es uno de los parques urbanos más viejos del continente.',
                'En el centro está el Observatorio Astronómico, fundado en 1873 por el presidente García Moreno: uno de los más antiguos de Sudamérica, todavía con su telescopio refractor alemán. Lo acompañan una laguna con botes de remo, el «churo» —una torrecilla en espiral— y, en la punta sur, el monumento a Simón Bolívar.',
            ],
        },
        ejido: {
            n: 'Parque El Ejido', s: 'Donde termina la ciudad vieja', z: 1,
            d: [['Origen', 'tierras comunales'], ['Hito', '28 de enero de 1912'], ['Fines de semana', 'feria de arte']],
            h: [
                'Un ejido era el potrero comunal a las afueras de la ciudad. Este marcó por siglos el límite norte de Quito; más allá empezaban las haciendas. Hoy separa el centro histórico de la ciudad moderna.',
                'Aquí terminó la «hoguera bárbara»: el 28 de enero de 1912 una turba arrastró por las calles e incineró en este llano los cuerpos del expresidente liberal Eloy Alfaro y de sus compañeros. Un monumento lo recuerda.',
                'En su entrada norte está el Arco de la Circasiana, una portada de piedra que perteneció a un palacio vecino. Los sábados y domingos el borde del parque se llena de pintores que venden sus cuadros, y adentro se juega ecuavóley y «cocos».',
            ],
        },
        casacultura: {
            n: 'Casa de la Cultura Ecuatoriana', s: 'El edificio de los espejos', z: 1,
            d: [['Fundación', '1944'], ['Fundador', 'Benjamín Carrión'], ['Museo', 'Museo Nacional (MuNa)']],
            h: [
                'Tras la derrota en la guerra de 1941 y la pérdida de territorio, el escritor Benjamín Carrión propuso una consigna: si el Ecuador no podía ser una potencia militar, sería una potencia de la cultura. De ahí nació, en 1944, la Casa de la Cultura.',
                'El gran edificio ovalado de vidrio alberga el Museo Nacional, con la colección arqueológica más importante del país. Su pieza emblema es el Sol de oro, una máscara de la cultura La Tolita con rayos en zigzag que sirve de logotipo al Banco Central.',
            ],
        },
        mariscal: {
            n: 'La Mariscal y Plaza Foch', s: 'El primer barrio del Quito moderno', z: 1,
            d: [['Urbanizada', 'desde 1920'], ['Nombre', 'por el mariscal Sucre']],
            h: [
                'Cuando la ciudad dejó de caber en el centro, las familias acomodadas se mudaron al norte de El Ejido y levantaron aquí, entre 1920 y 1950, villas y palacetes con jardín: una «ciudad jardín» de estilos mezclados, del neocolonial al art déco.',
                'Con el tiempo las casonas se volvieron hostales, restaurantes y bares. La Plaza Foch —oficialmente, Plaza El Quinde— es el centro de la vida nocturna, y a pocas cuadras está el Mercado Artesanal.',
            ],
        },
        universidad: {
            n: 'Universidad Central del Ecuador', s: 'La más antigua del país', z: 1,
            d: [['Raíces', '1620'], ['Nombre actual', '1826'], ['Campus', 'década de 1950']],
            h: [
                'Desciende de las universidades coloniales de Quito —San Gregorio Magno, de los jesuitas, y Santo Tomás, de los dominicos—, fundidas y rebautizadas como Universidad Central en 1826, en tiempos de la Gran Colombia.',
                'Su ciudadela universitaria, al pie del Pichincha, se construyó a mediados del siglo XX y es uno de los mejores conjuntos de arquitectura moderna de la ciudad.',
            ],
        },
        guapulo: {
            n: 'Santuario de Guápulo', s: 'El camino de Orellana', z: 1, campana: true,
            d: [['Construcción', '1649 – 1693'], ['Altitud', 'unos 2.690 m']],
            h: [
                'Un pueblo colgado de la ladera oriental, cien metros por debajo de la ciudad. Su santuario, del siglo XVII, guarda un púlpito tallado por Juan Bautista Menacho y pinturas de Miguel de Santiago.',
                'Por esta cuesta bajó en 1541 la expedición de Gonzalo Pizarro y Francisco de Orellana en busca del País de la Canela; Orellana terminó navegando el Amazonas entero hasta el Atlántico. La calle empedrada todavía se llama Camino de Orellana.',
            ],
        },
        capilla: {
            n: 'La Capilla del Hombre', s: 'El legado de Guayasamín', z: 1,
            d: [['Inauguración', '2002'], ['Barrio', 'Bellavista']],
            h: [
                'Oswaldo Guayasamín (1919 – 1999), el pintor ecuatoriano más conocido del siglo XX, la concibió como un homenaje al ser humano y, en especial, a los pueblos de América Latina: su sufrimiento y su esperanza. No alcanzó a verla abierta.',
                'El edificio, un cubo de piedra con una cúpula pintada, está junto a la casa donde vivió, hoy museo. En el jardín, bajo un pino que él mismo plantó —el Árbol de la Vida—, reposan sus cenizas.',
            ],
        },
        metropolitano: {
            n: 'Parque Metropolitano Guangüiltagua', s: 'El pulmón de Quito', z: 4,
            d: [['Extensión', '557 hectáreas'], ['Altitud', 'hasta 2.980 m']],
            h: [
                'Una loma entera cubierta de bosque, sobre todo de eucalipto, que cierra la ciudad por el oriente. Es el parque urbano más grande de Quito, con senderos para caminar y pedalear y esculturas dispersas entre los árboles.',
                'Desde sus miradores se ven, de un lado, los edificios de La Carolina; del otro, los valles de Cumbayá y Tumbaco y, en los días limpios, los nevados Cayambe, Antisana y Cotopaxi.',
            ],
        },

        // ───────────────────────── Norte ─────────────────────────
        carolina: {
            n: 'Parque La Carolina', s: 'El centro del Quito moderno', z: 2,
            d: [['Extensión', 'unas 64 hectáreas'], ['Largo', 'casi 1,5 km'], ['Abierto', '1976']],
            h: [
                'Fue la hacienda La Carolina, expropiada en 1939. La ciudad la alcanzó y la rodeó, y en los años setenta se abrió como parque. A su alrededor creció el distrito financiero, con las torres más altas del país.',
                'Tiene una laguna con botes de pedal, pista atlética, decenas de canchas, el Jardín Botánico —famoso por sus orquídeas—, el Vivarium y el Museo de Ciencias Naturales.',
                'La gran Cruz del Papa recuerda la misa que Juan Pablo II celebró aquí el 30 de enero de 1985 ante cientos de miles de personas.',
            ],
        },
        estadio: {
            n: 'Estadio Olímpico Atahualpa', s: 'La casa de la Tri', z: 2,
            d: [['Inauguración', '25 de noviembre de 1951'], ['Altitud', '2.782 m'], ['Aforo', 'unos 35.000']],
            h: [
                'El estadio donde la selección ecuatoriana se hizo fuerte. A casi 2.800 metros, con menos oxígeno y un balón que vuela distinto, pocos equipos visitantes se sintieron cómodos.',
                'El 7 de noviembre de 2001, un empate 1 a 1 con Uruguay —gol de Iván Kaviedes— clasificó aquí al Ecuador a su primer Mundial, el de Corea y Japón 2002. La avenida de afuera amaneció llena de gente.',
            ],
        },
        plazatoros: {
            n: 'Plaza de Toros Quito', s: 'Iñaquito', z: 2,
            d: [['Inauguración', '1960'], ['Aforo', 'unos 15.000']],
            h: [
                'Durante medio siglo fue la sede de la Feria de Quito «Jesús del Gran Poder», que cada diciembre acompañaba las fiestas de fundación de la ciudad.',
                'En la consulta popular de 2011 los quiteños votaron por prohibir los espectáculos en los que se mata al animal, y la feria dejó de celebrarse. Desde entonces el coso se usa para conciertos y otros eventos.',
            ],
        },
        bicentenario: {
            n: 'Parque Bicentenario', s: 'El antiguo aeropuerto', z: 2,
            d: [['Pista', '3.120 m'], ['Aeropuerto hasta', '19 de febrero de 2013'], ['Parque', 'más de 100 hectáreas']],
            h: [
                'Aquí aterrizaron los aviones durante más de setenta años. El Aeropuerto Mariscal Sucre quedó encerrado por la ciudad: los pilotos descendían entre cerros y edificios hacia una pista a 2.800 metros de altitud, una de las aproximaciones más exigentes del continente.',
                'La noche del 19 de febrero de 2013 despegó el último vuelo; al día siguiente abrió el nuevo aeropuerto en Tababela, al otro lado del valle. La pista se convirtió en parque: tres kilómetros rectos para caminar, patinar y pedalear, con las marcas de aterrizaje todavía pintadas.',
                'En su extremo sur está El Labrador, la estación terminal del norte del Metro.',
            ],
        },
        casablanca: {
            n: 'Estadio Rodrigo Paz Delgado', s: 'La Casa Blanca de Liga', z: 2,
            d: [['Inauguración', '6 de marzo de 1997'], ['Aforo', 'unos 41.000'], ['Barrio', 'Ponceano']],
            h: [
                'El estadio de Liga Deportiva Universitaria, el más grande de Quito. Sus graderías blancas en forma de olla le dieron el apodo.',
                'Aquí Liga ganó 4 a 2 a Fluminense el partido de ida de la final de la Copa Libertadores 2008. Una semana después, en el Maracaná, la definió por penales: es el único club ecuatoriano que ha levantado ese trofeo.',
            ],
        },
        cotocollao: {
            n: 'Cotocollao', s: 'Tres mil quinientos años de historia', z: 2,
            d: [['Cultura Cotocollao', '1500 – 500 a. C.'], ['Parroquia', 'colonial']],
            h: [
                'Mucho antes que Quito, a orillas de una laguna que ya no existe, hubo aquí una aldea de agricultores y alfareros: la cultura Cotocollao, una de las más antiguas de la Sierra. Una gran erupción del Pululahua, hace unos 2.400 años, la cubrió de ceniza.',
                'En la Colonia fue un pueblo de indios en el camino al norte, con su iglesia y su plaza. La ciudad lo absorbió en el siglo XX, pero el centro del barrio todavía conserva el trazado de pueblo.',
            ],
        },

        // ───────────────────────── Sur ─────────────────────────
        chimbacalle: {
            n: 'Estación de Chimbacalle', s: 'Donde llegó el tren', z: 3,
            d: [['Llegada del ferrocarril', '25 de junio de 1908'], ['Línea', 'Guayaquil – Quito']],
            h: [
                'El 25 de junio de 1908 entró aquí la primera locomotora desde la Costa. El Ferrocarril del Sur, la gran obra del presidente Eloy Alfaro, trepaba de cero a más de 3.600 metros y vencía la Nariz del Diablo con un zigzag tallado en la roca; se lo llamó «el ferrocarril más difícil del mundo».',
                'El tren cambió el barrio: alrededor de la estación crecieron fábricas textiles, molinos y las primeras ciudadelas obreras de Quito. Una de esas fábricas es hoy el Museo Interactivo de Ciencia.',
            ],
        },
        magdalena: {
            n: 'La Magdalena', s: 'El pueblo que quedó dentro de la ciudad', z: 3,
            d: [['Parroquia', 'siglo XVI'], ['Metro', 'estación La Magdalena']],
            h: [
                'Antes de la Conquista fue Machangarilla, un poblado al otro lado del río Machángara. Los españoles lo hicieron parroquia de indios bajo la advocación de María Magdalena, con iglesia y plaza propias.',
                'Hoy es la puerta del sur: aquí la ciudad se abre tras el paso estrecho entre el Panecillo y las laderas del Pichincha.',
            ],
        },
        recreo: {
            n: 'El Recreo y la Villaflora', s: 'El sur obrero', z: 3,
            d: [['Villaflora', 'trazada hacia 1948'], ['Metro y Trole', 'estación El Recreo']],
            h: [
                'La Villaflora fue uno de los primeros barrios planificados del sur: una ciudad jardín para empleados y obreros, con calles curvas que todavía se distinguen en el mapa.',
                'El Recreo ocupa los terrenos de una antigua fábrica textil. Su estación es uno de los grandes nudos de transporte del sur, donde se cruzan el Metro, el Trolebús y los alimentadores.',
            ],
        },
        solanda: {
            n: 'Solanda', s: 'El barrio que creció hacia arriba', z: 3,
            d: [['Construcción', 'década de 1980'], ['Origen', 'hacienda Solanda']],
            h: [
                'La hacienda de la familia de la marquesa de Solanda —la esposa del mariscal Sucre— fue donada para vivienda popular. En los años ochenta se levantó aquí uno de los mayores planes habitacionales del país: miles de casas mínimas, de un piso.',
                'Sus dueños las ampliaron por cuenta propia, piso sobre piso, hasta volverlo uno de los barrios más densos y comerciales de Quito. Desde arriba se nota: la trama es apretada y casi no quedan patios.',
            ],
        },
        chillogallo: {
            n: 'Chillogallo', s: 'La víspera de la batalla', z: 3,
            d: [['Hito', '23 de mayo de 1822'], ['Estadio', 'Gonzalo Pozo Ripalda, 1994']],
            h: [
                'En este pueblo acampó el ejército patriota la noche del 23 de mayo de 1822. De aquí salió el mariscal Sucre, a oscuras y bajo la lluvia, a trepar con sus tropas las laderas del Pichincha para rodear Quito; al amanecer del 24 los realistas los descubrieron y se libró la batalla.',
                'La casa donde se alojó Sucre todavía existe. A pocas cuadras está el estadio de Sociedad Deportiva Aucas, el «ídolo del pueblo» del sur.',
            ],
        },
        cuadras: {
            n: 'Parque Las Cuadras', s: 'El parque grande del sur', z: 3,
            d: [['Extensión', 'unas 24 hectáreas'], ['Abierto', '2009']],
            h: [
                'Una antigua hacienda convertida en parque, con bosque, huertos, vivero y una laguna. Es el respiro verde de Quitumbe y Chillogallo, dos de las zonas que más han crecido en las últimas décadas.',
            ],
        },
        quitumbe: {
            n: 'Terminal Quitumbe', s: 'La puerta del sur', z: 3,
            d: [['Terminal', '2009'], ['Metro', 'estación terminal del sur'], ['Altitud', 'unos 2.900 m']],
            h: [
                'De aquí salen los buses hacia la Sierra centro y sur, la Costa y la Amazonía. Es además la cabecera sur del Metro y del Trolebús: quien llega a Quito por tierra desde el sur empieza la ciudad en este punto.',
                'El nombre viene de una leyenda recogida por el padre Juan de Velasco: Quitumbe, hijo del rey Tumbe, habría subido desde la costa para fundar el reino de Quito.',
                'Esta parte del sur está más alta que el centro. Desde Quitumbe hasta El Labrador, la línea del Metro recorre unos 22 kilómetros y baja más de cien metros.',
            ],
        },

        // ───────────────────────── Cerros y miradores ─────────────────────────
        teleferico: {
            n: 'TelefériQo', s: 'De la ciudad al páramo en 18 minutos', z: 4,
            d: [['Abajo', '3.117 m'], ['Arriba, en Cruz Loma', '3.945 m'], ['Recorrido', '2,5 km'], ['Inauguración', '2005']],
            h: [
                'Uno de los teleféricos más altos del mundo. Las cabinas suben más de ochocientos metros por la ladera oriental del Pichincha: abajo queda el bosque de eucalipto, luego los matorrales, y arriba se abre el páramo, con su paja y sus almohadillas.',
                'Desde Cruz Loma, en un día despejado, se ve toda la ciudad —larga y angosta— y la fila de volcanes del otro lado: Cayambe, Antisana, Cotopaxi, los Ilinizas.',
                'Ahí empieza el sendero a la cumbre del Rucu Pichincha: unos cinco kilómetros y entre tres y cinco horas de ida y vuelta, con un tramo final de roca.',
            ],
        },
        rucu: {
            n: 'Volcán Pichincha', s: 'Rucu, el viejo, y Guagua, el niño', z: 4,
            d: [['Guagua Pichincha', '4.784 m'], ['Rucu Pichincha', '4.696 m'], ['Sobre la ciudad', 'casi 1.900 m']],
            h: [
                'Quito está recostada en su falda oriental. En kichwa, «rucu» es viejo y «guagua», niño: el Rucu, el que se ve desde la ciudad, está apagado; el Guagua, detrás, sigue activo.',
                'En 1660 el Guagua oscureció el cielo y cubrió Quito con una capa de ceniza. El 7 de octubre de 1999 volvió a hacerlo: una columna en forma de hongo se alzó sobre la ciudad y la ceniza cerró el aeropuerto.',
                'En sus laderas, a unos 3.500 metros, se libró el 24 de mayo de 1822 la Batalla de Pichincha, que liberó a Quito del dominio español. El sitio es hoy el museo de la Cima de la Libertad.',
            ],
            c: 'Alexander von Humboldt lo subió en 1802 y se asomó al cráter del Guagua. Ya antes, en la década de 1740, lo habían hecho los científicos de la Misión Geodésica.',
        },
        cima: {
            n: 'Cima de la Libertad', s: 'El campo de la Batalla de Pichincha', z: 4,
            d: [['Batalla', '24 de mayo de 1822'], ['Altitud', 'unos 3.100 m']],
            h: [
                'En estas pendientes, tan empinadas que la caballería no pudo intervenir, las tropas de Antonio José de Sucre —quiteños, guayaquileños, colombianos, peruanos, argentinos y un batallón británico— derrotaron al ejército realista de Melchor Aymerich.',
                'La capitulación se firmó al día siguiente y Quito pasó a formar parte de la Gran Colombia. Entre los caídos estuvo Abdón Calderón, un teniente de dieciocho años que siguió peleando tras recibir cuatro heridas.',
                'El Templo de la Patria, con un mural de Eduardo Kingman, guarda uniformes, armas y maquetas de la batalla.',
            ],
        },

        // ───────────────────────── Mitad del Mundo ─────────────────────────
        mitad: {
            n: 'Ciudad Mitad del Mundo', s: 'Latitud 0° 0′ 0″… más o menos', z: 5,
            d: [['Monumento', '30 m, 1979 – 1982'], ['Altitud', 'unos 2.480 m'], ['Desde el centro', '26 km']],
            h: [
                'Entre 1736 y 1744, la Misión Geodésica francesa —La Condamine, Godin, Bouguer— midió en estas tierras un arco del meridiano para resolver una disputa: ¿la Tierra es achatada en los polos o en el ecuador? Con ellos trabajó el sabio riobambeño Pedro Vicente Maldonado. De aquella misión le quedó al país su nombre.',
                'El monumento de piedra, coronado por un globo de cuatro toneladas y media, reemplazó en 1982 a uno más pequeño de 1936, que fue trasladado a Calacalí. Una línea amarilla marca el ecuador y divide la explanada en hemisferios.',
                'Con GPS se sabe hoy que la línea verdadera pasa unos 240 metros más al norte. Los pueblos antiguos lo tenían más claro: el sitio prehispánico de Catequilla, en un cerro cercano, está casi exactamente sobre la latitud cero.',
            ],
            c: 'Aquí el clima es otro: más bajo, más seco y más caliente que Quito. El valle de Pomasqui y San Antonio es casi un desierto de altura.',
        },
        pululahua: {
            n: 'Cráter del Pululahua', s: 'Un volcán con gente adentro', z: 5,
            d: [['Borde', 'unos 2.900 m'], ['Diámetro', 'unos 5 km'], ['Última erupción', 'hace unos 2.400 años']],
            h: [
                'Uno de los pocos cráteres habitados del mundo: en el fondo de la caldera, fértil y casi siempre cubierto de neblina por la tarde, hay fincas y sembríos.',
                'Su última gran erupción sepultó bajo ceniza a los pueblos del norte del valle de Quito, entre ellos la aldea de Cotocollao. Hoy es reserva geobotánica.',
            ],
        },

        // ───────────────────────── Transporte ─────────────────────────
        metro: {
            n: 'Metro de Quito', s: '15 estaciones · 22 km', z: 1,
            d: [['Inauguración', 'diciembre de 2023'], ['Recorrido', 'Quitumbe – El Labrador'], ['Viaje completo', '34 minutos'], ['Trenes', '6 vagones, 109 m']],
            h: [
                'El primer metro del Ecuador y uno de los más altos del mundo. Cruza la ciudad bajo tierra de sur a norte; lo que en la superficie puede tomar más de una hora y media, el tren lo hace en poco más de media.',
                'Las estaciones, de sur a norte: Quitumbe, Morán Valverde, Solanda, Cardenal de la Torre, El Recreo, La Magdalena, San Francisco, La Alameda, El Ejido, Universidad Central, La Pradera, La Carolina, Iñaquito, Jipijapa y El Labrador.',
                'La de San Francisco está bajo la plaza colonial: para no dañarla, los andenes se excavaron a mano en buena parte y la entrada se abrió dentro de una casa patrimonial.',
            ],
        },
        trole: {
            n: 'Trolebús', s: 'Desde 1995', z: 1,
            d: [['Inauguración', '17 de diciembre de 1995'], ['Corredor', 'Av. 10 de Agosto y Maldonado']],
            h: [
                'El primer sistema de transporte masivo de Quito: buses articulados eléctricos que circulan por un carril exclusivo, con paradas en andén. Recorre el eje central de la ciudad y atraviesa el Centro Histórico por las calles Guayaquil y Flores.',
                'Fue un modelo que luego copiaron otras ciudades andinas. Lo acompañan dos corredores paralelos: la Ecovía, por la avenida 6 de Diciembre, y el Corredor Occidental.',
            ],
        },
    };

    // ───────────────────────── Pasaporte ─────────────────────────
    const CLAVE = 'quito-pasaporte';
    let sellos = new Set();
    try { sellos = new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')); } catch (e) { /* sin almacenamiento: el pasaporte dura lo que dure la visita */ }
    const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify([...sellos])); } catch (e) { /* idem */ } };

    // ───────────────────────── La ficha ─────────────────────────
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    let ids = [];
    const F = (Q.ficha = {
        alIr: null,
        abrir(id, estacion = null) {
            const f = Q.INFO[id], card = document.querySelector('#card');
            if (!f || !card) return;
            card.textContent = '';
            const cerrar = el('button', 'cerrar', '×'); cerrar.type = 'button'; cerrar.setAttribute('aria-label', 'Cerrar'); cerrar.addEventListener('click', F.cerrar);
            card.append(cerrar, el('p', 'zona', Q.ZONAS[f.z]), el('h2', '', estacion ? 'Estación ' + estacion : f.n), el('p', 'sub', estacion ? f.n + ' · ' + f.s : f.s));
            if (f.d) { const dl = el('dl', 'datos'); f.d.forEach(([k, val]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', val)); dl.append(d); }); card.append(dl); }
            const texto = el('div', 'texto'); f.h.forEach((p) => texto.append(el('p', '', p)));
            if (f.c) texto.append(el('p', 'curiosidad', f.c));
            card.append(texto);
            if (ids.includes(id)) {
                const nuevo = !sellos.has(id); sellos.add(id); guardar();
                if (nuevo && Q.sfx) Q.sfx.purchase();
                card.append(el('p', 'sello' + (nuevo ? ' nuevo' : ''), `${nuevo ? '¡Sello nuevo!' : 'Ya sellado'} · pasaporte ${[...sellos].filter((s) => ids.includes(s)).length} de ${ids.length}`));
            }
            card.hidden = false; card.scrollTop = 0;
            F.marcar(id);
        },
        cerrar() { const c = document.querySelector('#card'); if (c) c.hidden = true; },
        marcar(activo) {
            document.querySelectorAll('#places button').forEach((b) => { b.classList.toggle('on', b.dataset.id === activo); b.classList.toggle('visto', sellos.has(b.dataset.id)); });
            const c = document.querySelector('#places .cuenta'); if (c) c.textContent = `Pasaporte ${[...sellos].filter((s) => ids.includes(s)).length}/${ids.length}`;
        },
        /** Arma la barra de lugares, agrupada por zona. Recibe pares [id, nombre corto]. */
        lugares(lista) {
            ids = lista.map(([id]) => id);
            const nav = document.querySelector('#places'); if (!nav) return;
            nav.textContent = '';
            nav.append(el('span', 'cuenta', ''));
            Q.ZONAS.forEach((zona, z) => {
                const suyos = lista.filter(([id]) => Q.INFO[id].z === z); if (!suyos.length) return;
                nav.append(el('span', 'zona', zona));
                suyos.forEach(([id, corto]) => {
                    const b = el('button', '', corto);
                    b.type = 'button'; b.dataset.id = id; b.title = Q.INFO[id].n;
                    b.addEventListener('click', () => { if (F.alIr) F.alIr(id); F.abrir(id); });
                    nav.append(b);
                });
            });
            F.marcar(null);
        },
    });
})();
