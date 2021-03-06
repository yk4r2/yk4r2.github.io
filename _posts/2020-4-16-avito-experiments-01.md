---
layout: post
title: Кейс от Авито... 
categories: [Product analysis,Statistics,Experiment theory]
---

...или как правильно смотреть на A/B тест, считать его MDE (за сколько времени/наблюдений можно почти наверное задетектировать сдвиг в n% с требуемой мощностью), он же - первая домашка по теории экспериментов.

Я решил извлечь ещё больше выгоды из того, что я постоянно делаю домашки от Академии Аналитиков Авито, поэтому сегодня мы с вами попробуем проанализировать датасет с результатами прошедшего в Авито эксперимента по тестированию монетизационных продуктов, что бы это ни значило.

Теперь, когда вы испугались фразы "монетизационные продукты", самое время пояснить, что это и вообще как. *Let us dive into*, как говорят американцы.

## Кейс 

Мы - аналитики в продуктовой дискавери команде. На текущий момент приближается начало нового квартала и нам необходимо спланировать эксперименты в нём.

У нас есть два продукта:

- Один *базовый* продукт, который предоставляет минимальный набор услуг на вашем ресурсе;
- Один *продвинутый* продукт, который предоставляет расширенный набор услуг.

На текущий момент на квартал у вашей команды есть для проверки две гипотезы:

- Дополнительное информирование об эффективности услуг будет стимулировать их покупку;
- Повышение цены базового продукта должно стимулировать покупку продвинутого продукта.

## Что мы будем с этим делать?

Для начала давайте загрузим датасет и посмотрим глазами на данные внутри.

### Описание данных
_event_date_ - дата\
_user_id_ - идентификатор пользователя\
_product_ - тип продукта (считай, варианты: A или B для нашего A/B теста)\
_amount_ - сумма покупок\
_transactions_ - количество транзакций

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-05-12.png) 
<div align="center">
<sup>
Посмотрели на датасет глазками
</sup>
</div>

Всегда сначала делаю `dataset.describe()`, а если у меня есть подозрение на *NaN*-значения, ещё и `dataset.info()`.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-16_23-58-37.png)
<div align="center">
<sup>
Собственно *.describe()*, видим, что даты хватает, ведь наблюдений более миллиона.
</sup>
</div>

Теперь самое время понять, с чем мы имеем дело. Я использую классику: `seaborn.pairplot()` просто потому что он удобный, `pairplot` показывает отношения между всеми парами переменных, а ещё имеет много разных наворотов вроде автогруппировки и автомасштаба, но платим мы откровенно хреновой скоростью работы, кучей занятой оперативы, пока он там составляет эту огромную матрицу и прочими крутыми side-effect'ами. Кстати, я делаю графичек только описательных переменных.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-16_23-58-54.png)
<div align="center">
<sup>
Примерно так выглядит *pairplot*. Красиво, но...
</sup>
</div>

Датасет содержит много наблюдений, но не то чтобы там много описательных метрик и в целом колонок.

Вижу выбросы - логарифмирую (хотя вряд ли это оптимальная стратегия):

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-00-05.png)
<div align="center">
<sup>
Прологарифмированный *pairplot*
</sup>
</div>

Выбросы мне не понравились, их уж очень хочется обрезать. Нарисуем датасет без лишних точек.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-00-30.png)
<div align="center">
<sup>
Выбросы отрезаны на глаз, можно порадоваться.
</sup>
</div>

Видите лесенку в начале? Это связано с тем, что значения целочисленные, а логарифм это нелинейное преобразование.

Тут у меня появилось дикое желание убрать из эксперимента дату, заменив группировкой по пользователю чтобы облегчить датасет и всё такое. Давайте посмотрим, что может помешать.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-01-02.png)
<div align="center">
<sup>
Проверим, что датасет собирался только во время проведения эксперимента
</sup>
</div>

Теперь давайте проверим классы на сбалансированность: если они не отбаланшены, нельзя удалять дату, ибо мы можем потерять информацию о сезонности.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-01-13.png)
<div align="center">
<sup>
Смотрим на то, сколько наблюдений в каждом из классов
</sup>
</div>

...и получаем, что данные не сбалансированы. Неприятно, но не критично: лечится введением *ratio*-метрик таких как средний чек на покупку. Проверяем дальше: построим графики как выше для каждой группы.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-01-35.png)
<div align="center">
<sup>
*Pairplot*'ы для каждой из групп A/B теста.
</sup>
</div>

Внимательный читатель, конечно, уже заметил повышение среднего чека у второй группы. Но мы не будем торопиться с выводами, а лучше подумаем над допметриками.

### Допметрики

Тут придумалось не сильно много:

- Средний чек на транзакцию для пользователя
- Средний чек на пользователя (без учёта даты, выходит)
- Количество транзакций для пользователя
- Общий чек на пользователя

Собственно где-то здесь я решил проверить, мол, а точно ли у нас все юзеры чётко разбиты по группам и ВНЕЗАПНО оказалось, что нет. Shame on you, Авито.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-02-01.png)
<div align="center">
<sup>
Группировка по юзерам + типу эксперимента даёт цифру больше, чем группировка по юзерам. Вывод: есть пересечения.
</sup>
</div>

Ладно, в целом, забьём на эту грязь в дате. В идеале я бы дропнул пересечения, но т.к. это было написано в 2 часа ночи вчера, просто не додумался.

Далее я решаю посчитать вышеописанные метрики, используя всякие группировки и дополнительный датафрейм, короче, кому надо, тот поймёт.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-02-20.png)
<div align="center">
<sup>
Доп. датафрейм + мердж
</sup>
</div>

Добавилось 3 новых метрики, но, если честно, надежды я возлагал на одну: *mean_transactions*, поэтому и дальнейшие графики построил только для неё.

Кстати, дабы не ждать полчаса, я решил максимально рандомно откусить у датафрейма десятую долю и строить графики с ней. Сильно много не потеряю, зато скорость построения графиков вырастет в разы. Делать это я собираюсь довольно стандартным методом: генерирую хэш от *id* пользователя и, если он делится на 10, кладу его в новый датафрейм, который буду позже изображать на графике.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-03-04.png)
<div align="center">
<sup>
Процедура откусывания десятой части датафрейма генерацией хеша и *pairplot*'ы
</sup>
</div>

Сдвиг, о котором я уже говорил чуть выше, подтверждается. Давайте честно посмотрим на него глазками:

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-03-22.png)
<div align="center">
<sup>
Гистограмма для двух разных групп
</sup>
</div>

Тут я подумал следующее: людям дали в руки *advanced* функционал. Люди не хотят думать, они хотят клац-клац в телефончик и продать вещь. Не могут же они просто взять и повысить средний чек, когда им дали сложный инструмент.

В мою голову тут же пришла светлая мысль: скорее всего, дело в том, что *advanced* пользуются более опытные ребята. Эту мысль подтверждала и несбалансированность выборок.

### Формализация гипотезы

#### Нулевая гипотеза выглядит следующим образом:
{Дополнительное информирование об эффективности услуг будет стимулировать их покупку} ∩ {Повышение цены базового продукта должно стимулировать покупку продвинутого продукта}

Разложим каждую из гипотез.

- Дополнительное информирование об эффективности услуг будет стимулировать их покупку ⇒ общее количество транзакций растёт, а средний чек не двигается
- Повышение цены базового продукта должно стимулировать покупку продвинутого продукта ⇒ рост среднего чека + рост средней выручки на пользователя, кажется что-то такое.

#### Хочется как-то придумать метрику
Казалось бы, есть ARPU (average revenue per user), но мне она не нравится, потому что в данном случае, кажется, она непросто считается.

Давайте возьмём вот какие метрики:

- Средний чек в зависимости от типа продукта
- Доля транзакций в зависимости от типа продукта
- Средняя выручка на пользователя
- Больше я не придумал, ибо тупенький

Вроде формализовали.

### MDE
Теперь время считать, сколько времени нам потребуется для точного нахождения отклонения в 4% в случае если мы будем делить группы людей поровну.

Посмотрим на то, сколько длился эксперимент в Авито

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-03-39.png)
<div align="center">
<sup>
91 день, жесть
</sup>
</div>

Допустим, мы хотим провести эксперимент как можно быстрее. Для этого напишем функцию, которая создаст две подвыборки для групп A и B эксперимента:

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-03-54.png)
<div align="center">
<sup>
Ну собственно любуйтесь на документацию. Я её немного изменил: сделал отрезание доли по хэшу как до этого.
</sup>
</div>

Теперь получим *MDE*. Каким образом? Попытаемся набрать нужную мощность эксперимента путём постепенного увеличения размера выборки.

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-04-11.png)
<div align="center">
<sup>
*mde_getter*: возьмёт ваш датафрейм, пройдётся по нему с шагом в 15 дней и получит, во сколько раз надо увеличить выборку, дабы получить минимальный детектируемый результат на уровне *result_effect*.
</sup>
</div>

Ну и получим примерно следующее: 

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-04-33.png)
<div align="center">
<sup>
*MDE* для основной метрики *amount*
</sup>
</div>

Давайте посмотрим на другие метрики, в том числе и на нашу ratio-метрику

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-04-55.png)
<div align="center">
<sup>
Наша метрика выбивается самой большой чувствительностью. Приятно.
</sup>
</div>

Ну и давайте тогда уж посмотрим на маленькую выборку:

![](/images/2020-4-16-avito-experiments-01/Screenshot_2021-04-17_00-05-12.png)
<div align="center">
<sup>
MDE для самой чувствительной метрики для каждых 15 дней с другими размерами выборки.
</sup>
</div>

Микровывод: кажется, наша метричка чувствительна настолько, что мы можем даже запустить эксперимент всего на одну неделю.

### Оптимизация плана
Давайте подумаем о вариантах того, как можно ускорить эти эксперименты, т.к. всегда могут образоваться ситуации, когда ваши гипотезы не подтвердились и они требуют изменения или уточнения и необходимости повторных тестов. А цели достигать всегда хорошо в рамках отведённого на них срока.

Во-первых, метрики бывают по-разному чувствительные, у нас вышла самой чувствительной `mean_amount`, наша *ratio*-метрика. Получается, что мы можем провести эксперимент хоть за неделю на выборке размера 10% от всех пользователей (затронув 20% всех пользователей), даже если не учитывать сезональность.\
Если же сезональность учитывать, выходит, что как раз есть смысл рассуждать в терминах одной недели.

Кстати, ещё как будто бы можно проверить гипотезы на не рандомно отобранных людях, но это уже сложновато, ибо могут возникнуть разные сайдэффекты.

### Собственно всё

[Исходный код](https://github.com/yk4r2/AAA/blob/main/Experiments/homeworks/HW1/main.ipynb)

[Датасет, с которым работали](https://github.com/yk4r2/AAA/blob/main/Experiments/homeworks/HW1/data/user_transactions.csv)

