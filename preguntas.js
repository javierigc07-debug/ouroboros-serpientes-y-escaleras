/* Banco de preguntas de OUROBOROS.
   · Unidad III (combinatoria): generadores con números al azar (la respuesta se calcula con código, así que siempre es correcta)
     y problemas del solucionario de permutaciones y combinaciones.
   · Cultura general: preguntas fijas.
   QBANK.make(rnd, used) devuelve { cat, dif, q, opts[4], ok, why }. rnd(a,b) es el azar de la partida, así que la repetición reproduce las mismas preguntas. */
(function () {
  const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const P = (n, r) => fact(n) / fact(n - r);
  const C = (n, r) => (r < 0 || r > n) ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r)));
  const fmt = n => n.toLocaleString('es');
  const pick = (rnd, arr) => arr[rnd(0, arr.length - 1)];

  /* ───── generadores de combinatoria: { dif, f(rnd) → { q, ans, bad[], why } } ───── */
  const WORDS = ['BANANA', 'ARRIBA', 'PAPAYA', 'REMEMBER', 'AGARRAR', 'MISSISSIPPI', 'ABRACADABRA'];
  const multinomial = w => { const m = {}; for (const ch of w) m[ch] = (m[ch] || 0) + 1; const reps = Object.values(m).filter(v => v > 1); return { total: fact(w.length) / reps.reduce((a, v) => a * fact(v), 1), reps, max: Math.max(...Object.values(m)) }; };
  const GEN = [
    { dif: 1, f: rnd => { const n = rnd(5, 10), r = rnd(2, 3), a = P(n, r);
      return { q: `En una carrera participan ${n} corredores. ¿De cuántas formas pueden quedar los ${r} primeros lugares del podio?`, ans: a, bad: [C(n, r), Math.pow(n, r), fact(n)],
        why: `Importa el orden, sin repetir: P(${n},${r}) = ${n}!/${n - r}! = ${fmt(a)}.` }; } },
    { dif: 1, f: rnd => { const n = rnd(6, 12), r = rnd(2, 4), a = C(n, r);
      return { q: `En un salón de ${n} alumnos se forma un comité de ${r}. ¿De cuántas maneras se puede elegir?`, ans: a, bad: [P(n, r), a + n, n * r],
        why: `No importa el orden: C(${n},${r}) = ${n}!/(${r}!·${n - r}!) = ${fmt(a)}.` }; } },
    { dif: 1, f: rnd => { const n = rnd(4, 8), a = fact(n);
      return { q: `¿De cuántas formas pueden hacer cola ${n} amigos para entrar al cine?`, ans: a, bad: [fact(n - 1), n * n, a / 2],
        why: `Son permutaciones de ${n} elementos: ${n}! = ${fmt(a)}.` }; } },
    { dif: 1, f: rnd => { const n = rnd(6, 9), r = rnd(3, 5), a = P(n, r);
      return { q: `Eduardo tiene ${n} libros. ¿De cuántas maneras puede acomodar ${r} de ellos en un estante?`, ans: a, bad: [C(n, r), Math.pow(n, r), fact(n)],
        why: `El orden en el estante importa: P(${n},${r}) = ${n}!/${n - r}! = ${fmt(a)}.` }; } },
    { dif: 1, f: rnd => { const n = rnd(7, 12), r = rnd(2, 4), isC = rnd(0, 1) === 1, a = isC ? C(n, r) : P(n, r);
      return { q: `Calcula ${isC ? 'C' : 'P'}(${n}, ${r}).`, ans: a, bad: isC ? [P(n, r), C(n, r - 1), C(n + 1, r)] : [C(n, r), P(n, r - 1), P(n + 1, r)],
        why: isC ? `C(n,r) = n!/(r!(n−r)!) → ${n}!/(${r}!·${n - r}!) = ${fmt(a)}.` : `P(n,r) = n!/(n−r)! → ${n}!/${n - r}! = ${fmt(a)}.` }; } },
    { dif: 1, f: rnd => { const n = rnd(5, 12), a = C(n, 2);
      return { q: `En un torneo de ajedrez juegan ${n} personas, cada una contra todas las demás una sola vez (sin revancha). ¿Cuántas partidas hay?`, ans: a, bad: [n * (n - 1), n * n, C(n, 3)],
        why: `Cada partida es un par sin orden: C(${n},2) = ${fmt(a)}.` }; } },
    { dif: 2, f: rnd => { const n = rnd(4, 8), a = fact(n - 1);
      return { q: `¿De cuántas formas se pueden sentar ${n} amigos alrededor de una mesa circular?`, ans: a, bad: [fact(n), fact(n - 2), a / 2],
        why: `Permutación circular: (n−1)! = ${n - 1}! = ${fmt(a)}.` }; } },
    { dif: 2, f: rnd => { const n = rnd(3, 6), a = Math.pow(2, n) - 1 - n;
      return { q: `Con ${n} frutas diferentes se preparan jugos surtidos de 2 frutas o más. ¿Cuántos jugos distintos se pueden hacer?`, ans: a, bad: [Math.pow(2, n), Math.pow(2, n) - 1, fact(n)],
        why: `Subconjuntos de ${n} elementos: 2^${n} = ${Math.pow(2, n)}. Se quitan el vacío y los ${n} de una sola fruta: ${Math.pow(2, n)} − 1 − ${n} = ${a}.` }; } },
    { dif: 2, f: rnd => { const n = rnd(3, 5); let a = 0; for (let k = 1; k <= n; k++) a += P(n, k);
      return { q: `Con ${n} banderas de colores distintos en un asta, se manda una señal usando al menos una bandera (el orden cambia la señal). ¿Cuántas señales hay?`, ans: a, bad: [fact(n), Math.pow(2, n) - 1, fact(n) * 2],
        why: `Se suman los arreglos con 1, 2, … ${n} banderas: ${Array.from({ length: n }, (_, i) => `P(${n},${i + 1})`).join(' + ')} = ${fmt(a)}.` }; } },
    { dif: 2, f: rnd => { const n = rnd(9, 14), k = rnd(4, 6), a = C(n - 1, k - 1);
      return { q: `Un club tiene ${n} jugadoras y una de ellas es la capitana. ¿Cuántos equipos de ${k} se pueden formar si la capitana siempre está?`, ans: a, bad: [C(n, k), C(n - 1, k), P(n - 1, k - 1)],
        why: `La capitana ya está fija; se eligen las ${k - 1} restantes entre ${n - 1}: C(${n - 1},${k - 1}) = ${fmt(a)}.` }; } },
    { dif: 3, f: rnd => { const w = pick(rnd, WORDS), m = multinomial(w), a = m.total;
      return { q: `¿Cuántas palabras diferentes (con o sin sentido) se pueden formar con todas las letras de ${w}?`, ans: a, bad: [fact(w.length), fact(w.length) / fact(m.max), fact(w.length) / 2],
        why: `Permutación con repetidos: ${w.length}! dividido entre ${m.reps.map(r => r + '!').join('·')} = ${fmt(a)}.` }; } },
    { dif: 3, f: rnd => { const n = rnd(5, 8), a = 2 * fact(n - 2);
      return { q: `${n} amigos se sientan alrededor de una fogata y una pareja de novios debe sentarse siempre junta. ¿De cuántas maneras pueden hacerlo?`, ans: a, bad: [fact(n - 1), fact(n - 2), 2 * fact(n - 1)],
        why: `Los novios se tratan como un solo bloque: (${n - 1} − 1)! = ${n - 2}! formas en círculo, por 2 maneras de ordenar la pareja: ${fmt(a)}.` }; } },
    { dif: 3, f: rnd => { const h = rnd(4, 6), m = rnd(2, 3), k = rnd(3, 4), a = C(h + m, k) - C(h, k);
      return { q: `Se elige un comité de ${k} entre ${h} hombres y ${m} mujeres. ¿De cuántas maneras se puede elegir con al menos una mujer?`, ans: a, bad: [C(h + m, k), m * C(h + m - 1, k - 1), C(m, 1) * C(h, k - 1)],
        why: `«Al menos una» = todos − ninguna mujer: C(${h + m},${k}) − C(${h},${k}) = ${fmt(a)}.` }; } },
    { dif: 3, f: rnd => { const h = rnd(2, 4), m = rnd(2, 3), a = P(m, 2) * fact(h + m - 2);
      return { q: `${h} hombres y ${m} mujeres posan en línea para una foto. ¿De cuántas maneras si debe haber una mujer en cada extremo?`, ans: a, bad: [fact(h + m), P(m, 2) * fact(h + m), fact(h + m - 2)],
        why: `Extremos: P(${m},2) = ${P(m, 2)}; el resto: ${h + m - 2}! = ${fact(h + m - 2)}. Total ${fmt(a)}.` }; } }
  ];

  /* ───── problemas del solucionario de permutaciones y combinaciones ───── */
  // [dif, pregunta, correcta, mala, mala, mala, explicación]
  const FIXED = [
    [1, 'Un juez otorga el primero, segundo y tercer premio de un concurso con ocho concursantes. ¿De cuántas formas puede hacerlo?', '336', '56', '512', '40 320', 'El orden importa: P(8,3) = 8·7·6 = 336.'],
    [1, 'El capitán de un barco necesita 2 marineros y se presentan 10. ¿De cuántas formas puede elegirlos?', '45', '90', '100', '20', 'No importa el orden: C(10,2) = 45.'],
    [1, 'Eduardo tiene 7 libros. ¿De cuántas maneras puede acomodar cinco de ellos en un estante?', '2 520', '21', '5 040', '16 807', 'P(7,5) = 7·6·5·4·3 = 2 520.'],
    [1, 'Se programa un torneo de ajedrez para 10 integrantes, cada uno juega con cada uno de los demás sin revancha. ¿Cuántos partidos hay?', '45', '90', '100', '55', 'C(10,2) = 45.'],
    [1, 'Una empresa contratará a 3 de 8 candidatos (6 hombres y 2 mujeres). ¿De cuántas maneras puede elegirlos?', '56', '336', '24', '20', 'C(8,3) = 8·7·6/3! = 56.'],
    [2, 'Cinco personas (tres hombres y dos mujeres) posan en línea para una foto. ¿De cuántas maneras pueden hacerlo?', '120', '60', '24', '720', '5! = 120.'],
    [2, 'En una línea de tres hombres y dos mujeres, ¿de cuántas maneras pueden colocarse si una mujer debe estar en cada extremo?', '12', '24', '36', '6', 'Las mujeres en los extremos: 2! = 2; los hombres en el medio: 3! = 6. Total 2·6 = 12.'],
    [2, 'Seis amigos se sientan alrededor de una mesa circular. ¿De cuántas formas pueden hacerlo?', '120', '720', '24', '60', 'Permutación circular: (6−1)! = 120.'],
    [2, 'Con 4 frutas diferentes, ¿cuántos jugos surtidos se pueden preparar si cada jugo lleva al menos 2 frutas?', '11', '15', '16', '24', 'Subconjuntos de 2, 3 y 4 frutas: C(4,2)+C(4,3)+C(4,4) = 6+4+1 = 11.'],
    [2, 'Un club de vóley tiene 12 jugadoras y una es la capitana María. ¿Cuántos equipos de 6 se pueden formar si María siempre está?', '462', '924', '792', '330', 'Falta elegir 5 entre las otras 11: C(11,5) = 462.'],
    [3, 'Un dado se lanza siete veces y se considera el orden. ¿De cuántas maneras pueden salir dos números 2, tres números 3, un 4 y un 5?', '420', '5 040', '210', '840', '7!/(2!·3!) = 5 040/12 = 420.'],
    [3, '¿Cuántas palabras diferentes se pueden formar con las letras de REMEMBER?', '1 680', '40 320', '6 720', '3 360', '8! entre las repeticiones: E×3, M×2, R×2 → 8!/(3!·2!·2!) = 1 680.'],
    [3, '¿Cuántas palabras diferentes se pueden formar con las letras de AGARRAR?', '140', '5 040', '840', '420', 'A×3, R×3 → 7!/(3!·3!) = 140.'],
    [3, 'Seis amigos se sientan alrededor de una fogata y los novios deben sentarse siempre juntos. ¿De cuántas maneras pueden hacerlo?', '48', '120', '240', '24', 'Bloque de novios: (5−1)! = 24 formas, por 2 formas de ordenarlos: 48.'],
    [3, 'Para la Copa Mundial hay 25 comentaristas y solo 6 hablan español. ¿Cuántos grupos de 4 se pueden formar si deben integrarse al menos dos que hablen español?', '2 960', '12 650', '5 814', '3 876', 'Todos − ninguno − exactamente uno: C(25,4) − C(19,4) − 6·C(19,3) = 12 650 − 3 876 − 5 814 = 2 960.'],
    [3, 'Con 4 banderas de colores distintos se envía una señal con al menos una bandera (el orden importa). ¿Cuántas señales son posibles?', '64', '24', '15', '256', 'P(4,1)+P(4,2)+P(4,3)+P(4,4) = 4+12+24+24 = 64.'],
    [1, '¿Cuánto vale 0!?', '1', '0', 'No está definido', '−1', 'Por definición 0! = 1, así C(n,0) = C(n,n) = 1.'],
    [1, '¿Cuál es la diferencia principal entre una permutación y una combinación?', 'En la permutación importa el orden; en la combinación no', 'En la combinación importa el orden; en la permutación no', 'La permutación usa suma y la combinación resta', 'No hay diferencia', 'P(n,r) cuenta arreglos ordenados; C(n,r) = P(n,r)/r! cuenta grupos sin orden.']
  ];

  /* ───── cultura general ───── */
  // [dif, pregunta, correcta, mala, mala, mala, explicación]
  const CULT = [
    [1, '¿Cuál es la capital de Venezuela?', 'Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Caracas es la capital y la ciudad más poblada del país.'],
    [1, '¿Dónde está el Salto Ángel, la cascada más alta del mundo?', 'Venezuela', 'Brasil', 'Perú', 'Colombia', 'Cae desde el Auyantepuy, en el Parque Nacional Canaima.'],
    [1, '¿Cuál es el río más caudaloso del mundo?', 'El Amazonas', 'El Orinoco', 'El Nilo', 'El Misisipi', 'El Amazonas lleva más agua que cualquier otro río.'],
    [1, '¿Cuál es la capital de Australia?', 'Canberra', 'Sídney', 'Melbourne', 'Perth', 'Sídney es la más famosa, pero la capital es Canberra.'],
    [1, '¿Cuál es el océano más grande del planeta?', 'Pacífico', 'Atlántico', 'Índico', 'Ártico', 'El Pacífico cubre cerca de un tercio de la superficie terrestre.'],
    [1, '¿Cuál es la montaña más alta del mundo sobre el nivel del mar?', 'Everest', 'K2', 'Aconcagua', 'Kilimanjaro', 'El Everest mide unos 8 849 m.'],
    [1, '¿Qué mar baña la costa norte de Venezuela?', 'Mar Caribe', 'Mar Mediterráneo', 'Mar Rojo', 'Mar del Norte', 'Venezuela tiene una larga costa sobre el Caribe.'],
    [1, '¿Cuál es el símbolo químico del oro?', 'Au', 'Ag', 'Or', 'Gd', 'Au viene del latín aurum.'],
    [1, '¿Cuál es el planeta más cercano al Sol?', 'Mercurio', 'Venus', 'Marte', 'Tierra', 'Mercurio es el primero, a unos 58 millones de km.'],
    [1, '¿Cuántos planetas tiene el sistema solar?', '8', '9', '7', '10', 'Plutón se reclasificó como planeta enano en 2006.'],
    [1, '¿Qué gas absorben las plantas para hacer la fotosíntesis?', 'Dióxido de carbono', 'Oxígeno', 'Nitrógeno', 'Hidrógeno', 'Usan CO₂ y luz para producir azúcares y liberan oxígeno.'],
    [1, '¿Cuál es el hueso más largo del cuerpo humano?', 'Fémur', 'Húmero', 'Tibia', 'Columna', 'El fémur está en el muslo.'],
    [1, '¿Quién fue el Libertador de Venezuela?', 'Simón Bolívar', 'Francisco de Miranda', 'Antonio José de Sucre', 'José Antonio Páez', 'Bolívar lideró la independencia de varias naciones sudamericanas.'],
    [1, '¿En qué año llegó Cristóbal Colón a América?', '1492', '1453', '1519', '1500', 'Llegó el 12 de octubre de 1492.'],
    [1, '¿Quién fue el primer ser humano en pisar la Luna?', 'Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'John Glenn', 'Fue en la misión Apolo 11, en 1969.'],
    [1, '¿Quién pintó La Mona Lisa?', 'Leonardo da Vinci', 'Miguel Ángel', 'Rafael', 'Pablo Picasso', 'La pintó a comienzos del siglo XVI.'],
    [1, '¿Quién escribió Don Quijote de la Mancha?', 'Miguel de Cervantes', 'Lope de Vega', 'Gabriel García Márquez', 'Federico García Lorca', 'Se publicó en 1605 y 1615.'],
    [1, '¿Cuántos bits tiene un byte?', '8', '4', '16', '10', 'Un byte agrupa 8 bits.'],
    [1, '¿Qué dígitos usa el sistema binario?', '0 y 1', '1 y 2', '0 al 7', '0 al 9', 'Los computadores representan todo con dos estados: 0 y 1.'],
    [1, '¿Qué significan las siglas CPU?', 'Unidad Central de Procesamiento', 'Control Personal de Usuario', 'Computadora Portátil Universal', 'Centro de Programas Únicos', 'Es el «cerebro» que ejecuta las instrucciones.'],
    [1, '¿Cuántos jugadores de cada equipo hay en la cancha en un partido de fútbol?', '11', '9', '10', '12', 'Cada equipo juega con 11, incluido el portero.'],
    [2, '¿Cuál es el elemento químico más abundante del universo?', 'Hidrógeno', 'Oxígeno', 'Helio', 'Carbono', 'Cerca del 75 % de la materia normal es hidrógeno.'],
    [2, '¿Qué unidad mide la fuerza en el Sistema Internacional?', 'Newton', 'Joule', 'Pascal', 'Watt', '1 newton = 1 kg·m/s².'],
    [2, '¿Cuál es el pH de una sustancia neutra como el agua pura?', '7', '0', '14', '1', 'Menos de 7 es ácido y más de 7 es básico.'],
    [2, '¿En qué año se firmó el Acta de Independencia de Venezuela?', '1811', '1810', '1821', '1830', 'El 5 de julio de 1811.'],
    [2, '¿En qué año terminó la Segunda Guerra Mundial?', '1945', '1939', '1918', '1950', 'Terminó en 1945 con la rendición de Japón.'],
    [2, '¿Qué civilización construyó Machu Picchu?', 'Los incas', 'Los mayas', 'Los aztecas', 'Los olmecas', 'Fue levantada en el siglo XV en los Andes peruanos.'],
    [2, '¿Qué país ganó el Mundial de fútbol de 2022?', 'Argentina', 'Francia', 'Brasil', 'Croacia', 'Ganó a Francia en la final, por penales.'],
    [2, '¿Quién escribió Cien años de soledad?', 'Gabriel García Márquez', 'Mario Vargas Llosa', 'Julio Cortázar', 'Rómulo Gallegos', 'Se publicó en 1967.'],
    [2, '¿Qué lenguaje se usa para dar estructura a las páginas web?', 'HTML', 'SQL', 'Python', 'C++', 'HTML describe los elementos de la página; CSS el estilo y JavaScript el comportamiento.'],
    [2, '¿Quién es considerada la primera programadora de la historia?', 'Ada Lovelace', 'Grace Hopper', 'Marie Curie', 'Hedy Lamarr', 'Escribió un algoritmo para la máquina analítica de Babbage.'],
    [2, '¿Quién creó el núcleo del sistema operativo Linux?', 'Linus Torvalds', 'Bill Gates', 'Steve Jobs', 'Dennis Ritchie', 'Lo publicó en 1991.'],
    [2, '¿Cuánto es 2 elevado a la 10?', '1 024', '1 000', '512', '2 048', '2¹⁰ = 1 024.'],
    [2, '¿Cuántas letras tiene el alfabeto español actual?', '27', '26', '28', '29', 'Desde 2010 la RAE no cuenta «ch» ni «ll» como letras.'],
    [2, '¿Cuál es el animal terrestre más rápido?', 'Guepardo', 'León', 'Caballo', 'Antílope', 'Alcanza unos 100 km/h en carreras cortas.'],
    [3, '¿Qué país tiene la mayor población del mundo desde 2023?', 'India', 'China', 'Estados Unidos', 'Indonesia', 'India superó a China en 2023.'],
    [3, 'En lógica, ¿cuál es el valor de verdad de «Verdadero Y Falso»?', 'Falso', 'Verdadero', 'Indeterminado', 'Depende del contexto', 'Una conjunción solo es verdadera si ambas partes lo son.'],
    [3, '¿Cuántas aristas tiene un grafo completo de 5 vértices?', '10', '5', '20', '25', 'Cada par de vértices se une una vez: C(5,2) = 10.'],
    [3, '¿Cuál es el único metal líquido a temperatura ambiente?', 'Mercurio', 'Galio', 'Plomo', 'Estaño', 'El mercurio funde a −39 °C.']
  ];

  const toQ = (cat, a) => ({ cat, dif: a[0], q: a[1], opts: a.slice(2, 6), why: a[6] });

  window.QBANK = {
    catName: { comb: 'Combinatoria · Unidad III', cult: 'Cultura general' },
    size: { fixed: FIXED.length, cult: CULT.length, gen: GEN.length },
    // used: Set de claves ya preguntadas en la partida (evita repetir preguntas fijas)
    make(rnd, used) {
      used = used || new Set();
      let item, cat;
      if (rnd(1, 100) <= 60) {                                  // 60 % combinatoria, 40 % cultura
        cat = 'comb';
        const free = FIXED.map((f, i) => i).filter(i => !used.has('f' + i));
        if (free.length && rnd(1, 100) <= 30) { const i = free[rnd(0, free.length - 1)]; used.add('f' + i); item = toQ('comb', FIXED[i]); }
        else {
          const g = GEN[rnd(0, GEN.length - 1)], r = g.f(rnd); const seen = new Set([r.ans]), bad = [];
          for (const b of r.bad) { const v = Math.round(b); if (v > 0 && !seen.has(v)) { seen.add(v); bad.push(v); } }
          for (let k = 1; bad.length < 3; k++) { const v = r.ans + k * (rnd(0, 1) ? 1 : -1) * Math.max(1, Math.round(r.ans * .1)); if (v > 0 && !seen.has(v)) { seen.add(v); bad.push(v); } }
          item = { cat, dif: g.dif, q: r.q, opts: [fmt(r.ans), ...bad.slice(0, 3).map(fmt)], why: r.why };
        }
      } else {
        cat = 'cult';
        const free = CULT.map((f, i) => i).filter(i => !used.has('c' + i)), pool = free.length ? free : CULT.map((f, i) => i);
        const i = pool[rnd(0, pool.length - 1)]; used.add('c' + i); item = toQ('cult', CULT[i]);
      }
      // la correcta va primero en los datos; aquí se baraja con el azar de la partida
      const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = rnd(0, i); [order[i], order[j]] = [order[j], order[i]]; }
      return { cat: item.cat, dif: item.dif, q: item.q, opts: order.map(i => item.opts[i]), ok: order.indexOf(0), why: item.why };
    }
  };
})();
