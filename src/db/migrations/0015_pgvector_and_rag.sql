CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "collaboration_embeddings" DROP COLUMN IF EXISTS "embedding";
--> statement-breakpoint
ALTER TABLE "collaboration_embeddings" ADD COLUMN "embedding" vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collaboration_embeddings_vector_idx" ON "collaboration_embeddings" USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"provider" text NOT NULL,
	"url" text,
	"description" text,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_resources_embedding_idx" ON "learning_resources" USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
INSERT INTO "learning_resources" ("title", "provider", "url", "description") VALUES
('Generative AI with Large Language Models', 'DeepLearning.AI & AWS', 'https://www.coursera.org/learn/generative-ai-with-llms', 'Master the fundamentals of generative AI and LLM architectures, fine-tuning techniques including PEFT and LoRA, and RLHF alignment.'),
('Practical Deep Learning for Coders', 'Fast.ai', 'https://course.fast.ai/', 'World-renowned hands-on course covering PyTorch, vision, NLP, tabular models, and practical deep learning applications.'),
('Hugging Face Transformers & Diffusion Course', 'Hugging Face', 'https://huggingface.co/learn/nlp-course', 'Comprehensive guide to mastering Hugging Face libraries, tokenization, training pipelines, and deploying NLP/diffusion models.'),
('CS25: Transformers United', 'Stanford University', 'https://web.stanford.edu/class/cs25/', 'Advanced Stanford seminar on Transformer models, attention mechanisms, vision transformers, and multimodal foundational models.'),
('Machine Learning Specialization', 'DeepLearning.AI & Stanford', 'https://www.coursera.org/specializations/machine-learning-introduction', 'Andrew Ng legendary 3-course foundational machine learning program covering supervised, unsupervised, and recommender systems.'),
('Deep Learning Specialization', 'DeepLearning.AI', 'https://www.coursera.org/specializations/deep-learning', 'Deep dive into neural networks, CNNs, sequence models, optimization algorithms, and deep learning structuring.'),
('Full Stack Deep Learning & LLM Bootcamp', 'FSDL', 'https://fullstackdeeplearning.com/', 'Engineering production-grade AI systems, LLMOps, model evaluation, observability, deployment, and real-world pipelines.'),
('Machine Learning Engineering for Production (MLOps)', 'DeepLearning.AI', 'https://www.coursera.org/specializations/machine-learning-engineering-for-production-mlops', 'Design end-to-end ML production pipelines, continuous delivery, data drift detection, and automated serving with TFX.'),
('CUDA Mode & GPU Kernel Programming', 'CUDA MODE', 'https://github.com/cuda-mode/lectures', 'High-performance GPU programming with CUDA C++, profiling, kernel optimization, warp mechanics, and memory hierarchy.'),
('Deep Reinforcement Learning Course', 'Hugging Face', 'https://huggingface.co/learn/deep-rl-course', 'Free certification course covering Q-Learning, Policy Gradients, Actor-Critic, PPO, and robotics environments in Unity and Gym.'),
('CS224N: Natural Language Processing with Deep Learning', 'Stanford University', 'https://web.stanford.edu/class/cs224n/', 'Stanford premier NLP course on word vectors, self-attention, transformers, prompting, and reasoning in modern language models.'),
('CS231n: Deep Learning for Computer Vision', 'Stanford University', 'https://cs231n.stanford.edu/', 'Architectures for image classification, object detection, segmentation, generative models, and visual representation learning.'),
('AI for Medicine Specialization', 'DeepLearning.AI', 'https://www.coursera.org/specializations/ai-for-medicine', 'Diagnosing diseases from X-rays, MRI segmentation, prognostic survival models, and clinical NLP pipelines.'),
('AI Safety, Alignment and Governance Fundamentals', 'BlueDot Impact', 'https://bluedot.org/', 'Technical course examining model alignment, interpretability, red-teaming, mechanistic interpretability, and AI risk governance.'),
('LangChain & LangGraph: Developing AI Agents', 'DeepLearning.AI & LangChain', 'https://www.deeplearning.ai/short-courses/', 'Build multi-agent workflows, autonomous tool-calling systems, memory persistence, and dynamic execution loops with LangGraph.'),
('RAG Systems and Advanced Vector Search', 'Pinecone & DeepLearning.AI', 'https://www.deeplearning.ai/short-courses/', 'Design production RAG pipelines with semantic chunking, hybrid keyword-vector search, re-ranking, and RAGAS evaluations.'),
('Accelerated Computing with CUDA C/C++', 'NVIDIA Deep Learning Institute', 'https://www.nvidia.com/en-us/training/', 'Hands-on hardware acceleration with NVIDIA GPUs, memory management, thread grids, and performance tuning.'),
('Reinforcement Learning Specialization', 'University of Alberta & Amii', 'https://www.coursera.org/specializations/reinforcement-learning', 'Formal mathematical treatment of Markov Decision Processes, dynamic programming, temporal difference learning, and planning.'),
('Distributed Computing for Machine Learning', 'UC Berkeley Sky Computing', 'https://sky.cs.berkeley.edu/', 'Distributed training with Ray, Megatron-LM, DeepSpeed, ZeRO memory optimization, and scaling across GPU clusters.'),
('Computer Systems: A Programmer Perspective (15-213)', 'Carnegie Mellon University', 'https://www.cs.cmu.edu/~213/', 'CMU flagship systems course: machine-level code, processor architecture, cache memories, concurrent programming, and virtual memory.'),
('Data Engineering Zoomcamp', 'DataTalks.Club', 'https://github.com/DataTalksClub/data-engineering-zoomcamp', 'Free engineering bootcamp covering Docker, SQL, Terraform, GCP, Airflow/Mage, Spark, Kafka, and dbt analytics pipelines.'),
('Mathematics for Machine Learning Specialization', 'Imperial College London', 'https://www.coursera.org/specializations/mathematics-machine-learning', 'Core linear algebra, multivariate calculus, and PCA foundations necessary for high-level machine learning research.'),
('Probabilistic Graphical Models', 'Stanford University & Daphne Koller', 'https://www.coursera.org/specializations/probabilistic-graphical-models', 'Bayesian networks, Markov random fields, exact and approximate inference, and structured probabilistic modeling.'),
('Robotics: Aerial Robotics & Perception', 'University of Pennsylvania', 'https://www.coursera.org/learn/robotics-flight', 'Control theory, state estimation with Kalman filters, quadrotor dynamics, and visual odometry algorithms.'),
('AI Ethics and Governance in Practice', 'The Alan Turing Institute', 'https://www.turing.ac.uk/', 'Frameworks for algorithmic fairness, bias mitigation, transparency, accountability, and regulatory compliance.'),
('Building Applications with Vector Databases', 'DeepLearning.AI', 'https://www.deeplearning.ai/short-courses/', 'Embeddings, similarity metrics, HNSW indexing, filtering, and scaling semantic search infrastructure.'),
('High Performance Python for Data Science and ML', 'Real Python', 'https://realpython.com/', 'Cython, Numba, multiprocessing, memory profiling, and NumPy vectorization strategies for high-throughput computation.'),
('LLM Twin: Building a Production AI Agent', 'Decoded Health & GitHub', 'https://github.com/decodingml', 'End-to-end production pipeline: data collection, feature pipelines, instruction fine-tuning, RAG, and microservice deployment.'),
('Modern Deep Learning with PyTorch Lightning', 'Lightning AI', 'https://lightning.ai/pages/courses/', 'Scalable model development, multi-GPU training, experiment tracking, and clean modular PyTorch structuring.'),
('Fast.ai: From Deep Learning Foundations to Stable Diffusion', 'Fast.ai', 'https://course.fast.ai/Lessons/part2.html', 'Build neural networks from scratch in Python, implementing autograd, backpropagation, and latent diffusion architectures.'),
('Machine Learning System Design', 'Stanford CS329S', 'https://stanford-cs329s.github.io/', 'End-to-end ML system architecture: requirements, data engineering, model development, monitoring, and continuous deployment.'),
('Data Structures and Algorithms Specialization', 'UC San Diego & HSE', 'https://www.coursera.org/specializations/data-structures-algorithms', 'Master algorithmic design, graph theory, dynamic programming, NP-completeness, and competitive programming paradigms.'),
('CS189: Introduction to Machine Learning', 'UC Berkeley', 'https://eecs189.org/', 'Rigorous mathematical derivations of SVMs, kernel methods, decision trees, boosting, neural nets, and statistical learning.'),
('Kubernetes for Machine Learning Engineers', 'Linux Foundation', 'https://training.linuxfoundation.org/', 'Container orchestration, deploying Kubeflow, GPU scheduling, ingress routing, and auto-scaling production workloads.'),
('Advanced SQL for Data Scientists & Analysts', 'Mode Analytics', 'https://mode.com/sql-tutorial/', 'Window functions, CTEs, query optimization, temporal queries, and database internals for high-performance analytics.'),
('Rust for Systems and Machine Learning', 'Rust Foundation & O''Reilly', 'https://www.rust-lang.org/learn', 'Memory safety without garbage collection, concurrency primitives, writing fast native extensions for Python with PyO3.'),
('TensorFlow: Advanced Techniques Specialization', 'DeepLearning.AI', 'https://www.coursera.org/specializations/tensorflow-advanced-techniques', 'Custom model architectures, Siamese networks, generative adversarial networks, and distributed strategy training.'),
('Microservices Architecture with Docker & gRPC', 'Coursera Project Network', 'https://www.coursera.org/', 'Build high-performance microservices communicating over protobuf and gRPC with distributed tracing and API gateways.'),
('Graph Neural Networks and Geometric Deep Learning', 'Stanford CS224W', 'https://web.stanford.edu/class/cs224w/', 'Machine learning with graphs: node classification, link prediction, Graph Convolutional Networks, and knowledge graphs.'),
('TinyML: Machine Learning on Edge Devices', 'Harvard University (edX)', 'https://www.edx.org/learn/machine-learning/harvard-university-tinyml', 'Deploying ultra-low-power machine learning models on microcontrollers, quantization, pruning, and edge inference.'),
('Computational Linear Algebra for Coders', 'Fast.ai & Rachel Thomas', 'https://github.com/fastai/numerical-linear-algebra', 'Matrix factorizations, SVD, randomized algorithms, NMF, and numerical stability in scientific computing.'),
('Automated Testing and CI/CD for Data Science', 'DataCamp', 'https://www.datacamp.com/', 'PyTest, data validation with Great Expectations, GitHub Actions automation, and regression testing for ML pipelines.'),
('Natural Language Understanding with Transformers', 'NYU Center for Data Science', 'https://cds.nyu.edu/', 'Modern semantic representations, syntactic parsing, question answering, and causal reasoning in language architectures.'),
('Speech and Audio Processing with Machine Learning', 'Hugging Face Audio Course', 'https://huggingface.co/learn/audio-course', 'Automatic Speech Recognition (ASR), Whisper fine-tuning, text-to-speech (TTS), and audio classification pipelines.'),
('C++ for High Performance and Scientific Computing', 'Coursera & EPFL', 'https://www.coursera.org/', 'Modern C++20 features, template metaprogramming, memory allocation strategies, and multi-threaded performance.'),
('AI Product Management Specialization', 'Duke University', 'https://www.coursera.org/specializations/ai-product-management', 'Evaluating AI viability, data privacy, user experience for probabilistic interfaces, and product roadmapping.'),
('Cloud Computing Specialization: AWS & GCP', 'University of Illinois Urbana-Champaign', 'https://www.coursera.org/specializations/cloud-computing', 'Cloud architecture principles, distributed storage systems, MapReduce, elasticity, and serverless compute primitives.'),
('Statistical Inference and Hypothesis Testing', 'Johns Hopkins University', 'https://www.coursera.org/learn/statistical-inference', 'Likelihood theory, Bayesian statistics, p-values, bootstrapping, and confidence intervals for rigorous scientific research.'),
('Cybersecurity in the Era of AI & Machine Learning', 'MIT xPRO', 'https://xpro.mit.edu/', 'Defending against adversarial attacks, model inversion, data poisoning, and secure enclave execution.'),
('Design of Interactive Systems for Human-AI Interaction', 'University of Washington', 'https://www.coursera.org/', 'Design guidelines for AI feedback, mixed-initiative interfaces, explainability, and user trust calibration.');
