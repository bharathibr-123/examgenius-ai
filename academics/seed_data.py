"""DEMO syllabus data (modules and topics follow the VTU 2022-scheme structure).

Importance (1-5) is a demo estimate of how often a topic is examined - faculty can change it
in the admin. Verify topics against your official syllabus.
Format: subject -> modules -> topics (name, importance, summary, [prerequisite names])
"""

SUBJECTS = [
    {
        "code": "BCS515B", "name": "Artificial Intelligence", "short": "AI", "semester": 5,
        "color": "violet", "icon": "BrainCircuit",
        "description": "Agents, search, knowledge representation, logic and planning.",
        "modules": [
            ("Introduction and Intelligent Agents", [
                ("What is AI and its foundations", 3, "Definitions of AI, the four approaches, foundations and history.", []),
                ("Agents and environments", 4, "Agent, percept, agent function, PEAS description.", ["What is AI and its foundations"]),
                ("Nature of environments", 4, "Observable, deterministic, episodic, static, discrete, multi-agent.", ["Agents and environments"]),
                ("Structure of agents", 5, "Simple reflex, model-based, goal-based, utility-based, learning agents.", ["Agents and environments"]),
            ]),
            ("Problem Solving by Searching", [
                ("Problem-solving agents and problem formulation", 4, "State space, initial state, actions, goal test, path cost.", ["Structure of agents"]),
                ("Breadth-first and uniform-cost search", 5, "FIFO frontier, completeness, optimality, complexity.", ["Problem-solving agents and problem formulation"]),
                ("Depth-first and iterative deepening search", 5, "LIFO frontier, depth limit, IDDFS trade-offs.", ["Problem-solving agents and problem formulation"]),
                ("Bidirectional search and comparison of strategies", 3, "Searching from both ends; comparing uninformed strategies.", ["Breadth-first and uniform-cost search"]),
            ]),
            ("Informed Search and Logical Agents", [
                ("Heuristic functions", 4, "Admissible and consistent heuristics, effective branching factor.", ["Breadth-first and uniform-cost search"]),
                ("Greedy best-first and A* search", 5, "f(n)=g(n)+h(n), optimality of A*, examples.", ["Heuristic functions"]),
                ("Knowledge-based agents and Wumpus world", 4, "KB, TELL/ASK, the Wumpus world example.", ["Structure of agents"]),
                ("Propositional logic", 5, "Syntax, semantics, entailment, inference, CNF.", ["Knowledge-based agents and Wumpus world"]),
            ]),
            ("First-Order Logic", [
                ("Syntax and semantics of FOL", 5, "Constants, predicates, functions, quantifiers.", ["Propositional logic"]),
                ("Using FOL and knowledge engineering", 4, "Assertions, queries, the knowledge-engineering process.", ["Syntax and semantics of FOL"]),
                ("Unification and lifting", 4, "Most general unifier, generalised modus ponens.", ["Syntax and semantics of FOL"]),
                ("Forward chaining", 5, "Data-driven inference with definite clauses.", ["Unification and lifting"]),
            ]),
            ("Inference and Planning", [
                ("Backward chaining", 5, "Goal-driven inference, logic programming.", ["Unification and lifting"]),
                ("Resolution in FOL", 5, "Conversion to CNF, resolution refutation, examples.", ["Unification and lifting", "Propositional logic"]),
                ("Classical planning", 4, "PDDL, state-space planning, forward and backward search.", ["Greedy best-first and A* search"]),
                ("Planning graphs", 3, "Levels, mutex links, GRAPHPLAN.", ["Classical planning"]),
            ]),
        ],
    },
    {
        "code": "BCS602", "name": "Machine Learning", "short": "ML", "semester": 6,
        "color": "blue", "icon": "LineChart",
        "description": "Data understanding, supervised and unsupervised learning, evaluation.",
        "modules": [
            ("Introduction to Machine Learning", [
                ("Need for ML and types of learning", 4, "Supervised, unsupervised, semi-supervised and reinforcement learning.", []),
                ("Challenges and the ML process", 3, "Data quality, overfitting, CRISP-DM style workflow.", ["Need for ML and types of learning"]),
                ("Types of data and descriptive statistics", 4, "Mean, median, mode, variance, standard deviation.", []),
            ]),
            ("Understanding Data", [
                ("Bivariate and multivariate analysis", 3, "Covariance, correlation, scatter plots.", ["Types of data and descriptive statistics"]),
                ("Data preprocessing", 4, "Missing values, outliers, normalisation, encoding.", ["Types of data and descriptive statistics"]),
                ("Feature engineering and PCA", 5, "Feature selection, dimensionality reduction, principal components.", ["Bivariate and multivariate analysis"]),
            ]),
            ("Learning Theory and Regression", [
                ("Bias, variance and overfitting", 5, "Under/overfitting, bias-variance trade-off, cross-validation.", ["Challenges and the ML process"]),
                ("Similarity-based learning (k-NN)", 4, "Distance measures, choosing k, weighted k-NN.", ["Data preprocessing"]),
                ("Linear regression", 5, "Least squares, cost function, gradient descent.", ["Types of data and descriptive statistics"]),
                ("Logistic regression", 4, "Sigmoid, log-loss, binary classification.", ["Linear regression"]),
            ]),
            ("Decision Trees and Bayesian Learning", [
                ("Decision tree learning (ID3)", 5, "Entropy, information gain, tree construction, pruning.", ["Need for ML and types of learning"]),
                ("Bayesian learning and Naive Bayes", 5, "Bayes theorem, MAP, Naive Bayes classifier.", ["Types of data and descriptive statistics"]),
                ("Model evaluation metrics", 4, "Confusion matrix, accuracy, precision, recall, F1.", ["Logistic regression"]),
            ]),
            ("Neural Networks and Clustering", [
                ("Perceptron and artificial neural networks", 5, "Perceptron rule, MLP, backpropagation.", ["Linear regression"]),
                ("Clustering (k-means and hierarchical)", 5, "k-means algorithm, dendrograms, choosing k.", ["Similarity-based learning (k-NN)"]),
                ("Support vector machines", 3, "Margins, support vectors, kernels.", ["Logistic regression"]),
            ]),
        ],
    },
    {
        "code": "DL701", "name": "Deep Learning", "short": "DL", "semester": 7,
        "color": "fuchsia", "icon": "Network",
        "description": "Neural network training, CNNs, sequence models and generative models.",
        "modules": [
            ("Foundations of Deep Learning", [
                ("Deep learning vs machine learning", 3, "Representation learning, why depth helps.", []),
                ("Multilayer perceptron", 5, "Layers, forward pass, universal approximation.", ["Deep learning vs machine learning"]),
                ("Activation functions", 4, "Sigmoid, tanh, ReLU, softmax and their gradients.", ["Multilayer perceptron"]),
            ]),
            ("Training Deep Networks", [
                ("Loss functions", 4, "MSE, cross-entropy, choosing a loss.", ["Multilayer perceptron"]),
                ("Gradient descent and backpropagation", 5, "Chain rule, computational graph, vanishing gradients.", ["Loss functions", "Activation functions"]),
                ("Optimizers (SGD, Momentum, Adam)", 4, "Learning rate, momentum, adaptive methods.", ["Gradient descent and backpropagation"]),
                ("Regularization (dropout, batch norm)", 5, "Dropout, weight decay, batch normalisation, early stopping.", ["Gradient descent and backpropagation"]),
            ]),
            ("Convolutional Neural Networks", [
                ("Convolution and pooling", 5, "Kernels, stride, padding, feature maps, pooling.", ["Multilayer perceptron"]),
                ("CNN architectures", 4, "LeNet, AlexNet, VGG, ResNet and skip connections.", ["Convolution and pooling"]),
                ("Transfer learning", 4, "Pre-trained models, fine-tuning, feature extraction.", ["CNN architectures"]),
            ]),
            ("Sequence Models", [
                ("Recurrent neural networks", 5, "Unrolling, BPTT, vanishing gradients in RNNs.", ["Gradient descent and backpropagation"]),
                ("LSTM and GRU", 5, "Gates, cell state, when to use each.", ["Recurrent neural networks"]),
                ("Attention and transformers", 4, "Self-attention, multi-head attention, positional encoding.", ["LSTM and GRU"]),
            ]),
            ("Generative Models and Applications", [
                ("Autoencoders", 4, "Encoder-decoder, latent space, denoising autoencoders.", ["Multilayer perceptron"]),
                ("Generative adversarial networks", 4, "Generator, discriminator, adversarial training.", ["Autoencoders"]),
                ("Deep learning applications", 3, "Vision, NLP, speech; deployment considerations.", ["Transfer learning"]),
            ]),
        ],
    },
    {
        "code": "BRMK557", "name": "Research Methodology and IPR", "short": "RM", "semester": 5,
        "color": "amber", "icon": "FlaskConical",
        "description": "Research process, design, data collection, and intellectual property rights.",
        "modules": [
            ("Introduction to Research", [
                ("Meaning, objectives and types of research", 4, "Descriptive vs analytical, applied vs fundamental, qualitative vs quantitative.", []),
                ("Research process", 5, "Steps from problem formulation to report writing.", ["Meaning, objectives and types of research"]),
                ("Defining the research problem", 4, "Selecting and defining a problem, techniques involved.", ["Research process"]),
            ]),
            ("Literature Review and Research Design", [
                ("Reviewing the literature", 4, "Purpose, sources, writing a literature review, citations.", ["Defining the research problem"]),
                ("Research design", 5, "Features of a good design, exploratory, descriptive, experimental designs.", ["Defining the research problem"]),
                ("Sampling design", 4, "Probability and non-probability sampling, sample size.", ["Research design"]),
            ]),
            ("Data Collection and Analysis", [
                ("Methods of data collection", 4, "Primary vs secondary data, questionnaires, interviews, observation.", ["Sampling design"]),
                ("Hypothesis testing", 5, "Null and alternative hypotheses, type I/II errors, significance.", ["Methods of data collection"]),
                ("Interpretation and report writing", 4, "Structure of a research report, precautions in interpretation.", ["Hypothesis testing"]),
            ]),
            ("Intellectual Property: Patents and Copyright", [
                ("Introduction to IPR", 4, "Types of intellectual property and why it matters.", []),
                ("Patents", 5, "Patentability criteria, filing procedure, rights of a patentee.", ["Introduction to IPR"]),
                ("Copyright", 5, "Works protected, rights, term, infringement, software copyright.", ["Introduction to IPR"]),
            ]),
            ("Trademarks and Other IPR", [
                ("Trademarks", 4, "Registration, types of marks, infringement and passing off.", ["Introduction to IPR"]),
                ("Industrial designs and geographical indications", 4, "Design registration, GI tags and examples from India.", ["Introduction to IPR"]),
                ("Trade secrets and IPR in research", 3, "Protecting confidential information, IPR in academic work.", ["Patents"]),
            ]),
        ],
    },
    {
        "code": "BCS403", "name": "Database Management Systems", "short": "DBMS", "semester": 4,
        "color": "emerald", "icon": "Database",
        "description": "Data models, SQL, normalisation and transaction processing.",
        "modules": [
            ("Introduction and ER Model", [
                ("Database concepts and architecture", 4, "DBMS advantages, three-schema architecture, data independence.", []),
                ("Entity-relationship model", 5, "Entities, attributes, relationships, cardinality, weak entities.", ["Database concepts and architecture"]),
            ]),
            ("Relational Model and Algebra", [
                ("Relational model and constraints", 4, "Keys, domain, entity and referential integrity.", ["Database concepts and architecture"]),
                ("Relational algebra", 5, "Select, project, join, division, set operations.", ["Relational model and constraints"]),
                ("ER-to-relational mapping", 4, "Mapping entities, relationships and multivalued attributes.", ["Entity-relationship model", "Relational model and constraints"]),
            ]),
            ("SQL", [
                ("Basic SQL queries", 5, "DDL, DML, SELECT-FROM-WHERE, ORDER BY, aggregates.", ["Relational algebra"]),
                ("Advanced SQL: joins, nested queries, views", 5, "Joins, correlated subqueries, GROUP BY-HAVING, views.", ["Basic SQL queries"]),
                ("Triggers and stored procedures", 3, "Event-condition-action rules, assertions.", ["Advanced SQL: joins, nested queries, views"]),
            ]),
            ("Normalization", [
                ("Functional dependencies", 5, "Armstrong's axioms, closure, minimal cover.", ["Relational model and constraints"]),
                ("Normal forms (1NF to BCNF)", 5, "1NF, 2NF, 3NF, BCNF with examples.", ["Functional dependencies"]),
                ("Decomposition properties", 4, "Lossless join and dependency preservation.", ["Normal forms (1NF to BCNF)"]),
            ]),
            ("Transactions and NoSQL", [
                ("Transactions and ACID properties", 5, "Transaction states, schedules, serializability.", ["Basic SQL queries"]),
                ("Concurrency control", 5, "Two-phase locking, deadlocks, timestamp ordering.", ["Transactions and ACID properties"]),
                ("Recovery and NoSQL databases", 3, "Log-based recovery, checkpoints, NoSQL types.", ["Transactions and ACID properties"]),
            ]),
        ],
    },
    {
        "code": "BCS502", "name": "Computer Networks", "short": "CN", "semester": 5,
        "color": "sky", "icon": "Globe",
        "description": "Network models, data link, network, transport and application layers.",
        "modules": [
            ("Introduction and Network Models", [
                ("Data communication and network types", 3, "Components, topologies, LAN/WAN, switching.", []),
                ("OSI and TCP/IP models", 5, "Layers, functions, encapsulation, comparison.", ["Data communication and network types"]),
            ]),
            ("Data Link Layer", [
                ("Framing and error detection (CRC)", 5, "Framing, parity, checksum, CRC computation.", ["OSI and TCP/IP models"]),
                ("Flow control protocols", 4, "Stop-and-wait, Go-Back-N, Selective Repeat.", ["Framing and error detection (CRC)"]),
                ("Media access control", 4, "ALOHA, CSMA/CD, CSMA/CA.", ["OSI and TCP/IP models"]),
            ]),
            ("Network Layer", [
                ("IPv4 addressing and subnetting", 5, "Classful, CIDR, subnet masks, NAT.", ["OSI and TCP/IP models"]),
                ("Routing algorithms", 5, "Distance vector, link state, Dijkstra, RIP and OSPF.", ["IPv4 addressing and subnetting"]),
                ("IPv6", 3, "Address format, header, transition from IPv4.", ["IPv4 addressing and subnetting"]),
            ]),
            ("Transport Layer", [
                ("UDP and TCP services", 4, "Ports, segments, connectionless vs connection-oriented.", ["OSI and TCP/IP models"]),
                ("TCP connection management", 5, "Three-way handshake, termination, state diagram.", ["UDP and TCP services"]),
                ("TCP congestion control", 4, "Slow start, congestion avoidance, fast retransmit.", ["TCP connection management"]),
            ]),
            ("Application Layer", [
                ("DNS", 4, "Name space, resolution, record types.", ["UDP and TCP services"]),
                ("HTTP and the web", 4, "Request/response, methods, status codes, cookies.", ["TCP connection management"]),
                ("Email and FTP", 3, "SMTP, POP3, IMAP, FTP control and data connections.", ["TCP connection management"]),
            ]),
        ],
    },
]

# Cross-subject prerequisites (topic name -> prerequisite topic name)
CROSS_PREREQS = [
    ("Multilayer perceptron", "Perceptron and artificial neural networks"),
    ("Gradient descent and backpropagation", "Linear regression"),
    ("Need for ML and types of learning", "What is AI and its foundations"),
]
